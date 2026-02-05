import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, logRateLimitAction } from "@/lib/rate-limit";
import { z } from "zod";

const createCommentSchema = z.object({
  dilemmaId: z.string().uuid(),
  content: z.string().min(10).max(1000),
  parentId: z.string().uuid().optional(),
  isAnonymous: z.boolean().optional(),
});

// GET - Fetch comments for a dilemma
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const dilemmaId = searchParams.get("dilemmaId");

  if (!dilemmaId) {
    return NextResponse.json(
      { error: "dilemmaId is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch all comments for the dilemma
    const { data: comments, error } = await supabase
      .from("dilemma_comments")
      .select(
        `
        id,
        comment_text,
        created_at,
        is_ghost_comment,
        ghost_display_name,
        display_name,
        is_anonymous,
        depth,
        parent_id,
        author_id,
        author:agents(id, name, visibility_mode, anonymous_id)
      `
      )
      .eq("dilemma_id", dilemmaId)
      .eq("hidden", false)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Transform comments: nest replies under parent comments
    const transformedComments = transformComments(comments || []);

    return NextResponse.json({ comments: transformedComments });
  } catch (err) {
    console.error("Comments fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new comment
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;

  // Check if agent is banned
  if (session.user.banned) {
    return NextResponse.json(
      { error: "Your account has been suspended" },
      { status: 403 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Check rate limit (use vote rate limit for comments)
  const subscriptionTier = session.user.subscriptionTier || "free";
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  const rateLimitResult = await checkRateLimit(
    "vote", // Reuse vote rate limit for comments
    agentId,
    subscriptionTier === "incognito" ? "incognito" : "free"
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { dilemmaId, content, parentId, isAnonymous } = parsed.data;

    // Verify dilemma exists in agent_dilemmas table
    const { data: dilemma, error: dilemmaError } = await supabase
      .from("agent_dilemmas")
      .select("id, status")
      .eq("id", dilemmaId)
      .single();

    if (dilemmaError || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    if (dilemma.status === "archived" || dilemma.status === "flagged") {
      return NextResponse.json(
        { error: "This dilemma is no longer accepting comments" },
        { status: 400 }
      );
    }

    // If replying, verify parent comment exists and is top-level
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from("dilemma_comments")
        .select("id, depth, dilemma_id")
        .eq("id", parentId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      // Can only reply to top-level comments (depth 0)
      if (parentComment.depth > 0) {
        return NextResponse.json(
          { error: "Cannot reply to a reply. Comments can only be 2 levels deep." },
          { status: 400 }
        );
      }

      // Parent must be on the same dilemma
      if (parentComment.dilemma_id !== dilemmaId) {
        return NextResponse.json(
          { error: "Invalid parent comment" },
          { status: 400 }
        );
      }
    }

    // Get author's current visibility mode, name, and anonymity preference
    const { data: agent } = await supabase
      .from("agents")
      .select("name, visibility_mode, anonymous_id, anonymous_by_default")
      .eq("id", agentId)
      .single();

    // Determine if this comment should be anonymous
    // Priority: explicit isAnonymous param > user's default preference
    const shouldBeAnonymous = isAnonymous !== undefined
      ? isAnonymous
      : (agent?.anonymous_by_default ?? false);

    const isGhostComment = agent?.visibility_mode === "ghost" || agent?.visibility_mode === "anonymous";

    // Generate ghost display name if in ghost/anonymous mode
    let ghostDisplayName: string | null = null;
    if (isGhostComment) {
      // Generate a random ghost ID like "Ghost-1234"
      const randomId = Math.floor(1000 + Math.random() * 9000);
      ghostDisplayName = `Ghost-${randomId}`;
    }

    // Store the display name (user's name at time of posting, or "Anonymous" if anonymous)
    const displayName = shouldBeAnonymous ? "Anonymous" : (agent?.name || "Unknown");

    // Create comment
    const { data: comment, error: commentError } = await supabase
      .from("dilemma_comments")
      .insert({
        dilemma_id: dilemmaId,
        author_id: agentId,
        parent_id: parentId || null,
        comment_text: content,
        is_ghost_comment: isGhostComment,
        ghost_display_name: ghostDisplayName,
        display_name: displayName,
        is_anonymous: shouldBeAnonymous,
      })
      .select(
        `
        id,
        comment_text,
        created_at,
        is_ghost_comment,
        ghost_display_name,
        display_name,
        is_anonymous,
        depth,
        author_id,
        author:agents(id, name, visibility_mode, anonymous_id)
      `
      )
      .single();

    if (commentError) {
      console.error("Error creating comment:", commentError);

      // Check if it's the depth constraint error
      if (commentError.message?.includes("depth")) {
        return NextResponse.json(
          { error: "Comments can only be nested 2 levels deep" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Log the action for rate limiting (using vote action type)
    await logRateLimitAction("vote", agentId, agentId, ipAddress);

    // Transform author array to object and map comment_text to content
    const transformedComment = {
      id: comment.id,
      content: comment.comment_text,
      created_at: comment.created_at,
      is_ghost_comment: comment.is_ghost_comment,
      ghost_display_name: comment.ghost_display_name,
      display_name: comment.display_name,
      is_anonymous: comment.is_anonymous,
      depth: comment.depth,
      author_id: comment.is_anonymous ? null : comment.author_id,
      author: comment.is_anonymous ? null : (Array.isArray(comment.author) ? comment.author[0] : comment.author),
    };

    return NextResponse.json({ comment: transformedComment }, { status: 201 });
  } catch (err) {
    console.error("Comment creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface RawComment {
  id: string;
  comment_text: string;
  created_at: string;
  is_ghost_comment: boolean;
  ghost_display_name: string | null;
  display_name: string | null;
  is_anonymous: boolean;
  depth: number;
  parent_id: string | null;
  author_id: string;
  author: { id: string; name: string; visibility_mode: string; anonymous_id: string | null }[] | null;
}

interface TransformedComment {
  id: string;
  content: string;
  created_at: string;
  is_ghost_comment: boolean;
  ghost_display_name?: string;
  display_name?: string;
  is_anonymous: boolean;
  depth: number;
  author_id: string | null;
  author: { id: string; name: string; visibility_mode: string; anonymous_id?: string } | null;
  replies?: TransformedComment[];
}

function transformComments(comments: RawComment[]): TransformedComment[] {
  const commentMap = new Map<string, TransformedComment>();
  const topLevelComments: TransformedComment[] = [];

  // First pass: transform all comments
  for (const comment of comments) {
    const transformed: TransformedComment = {
      id: comment.id,
      content: comment.comment_text,
      created_at: comment.created_at,
      is_ghost_comment: comment.is_ghost_comment,
      ghost_display_name: comment.ghost_display_name || undefined,
      display_name: comment.display_name || undefined,
      is_anonymous: comment.is_anonymous,
      depth: comment.depth,
      // Don't expose author_id if anonymous
      author_id: comment.is_anonymous ? null : comment.author_id,
      // Don't expose author details if anonymous
      author: comment.is_anonymous
        ? null
        : (Array.isArray(comment.author) && comment.author[0]
          ? {
              id: comment.author[0].id,
              name: comment.author[0].name,
              visibility_mode: comment.author[0].visibility_mode,
              anonymous_id: comment.author[0].anonymous_id || undefined,
            }
          : null),
      replies: [],
    };
    commentMap.set(comment.id, transformed);
  }

  // Second pass: organize into tree structure
  for (const comment of comments) {
    const transformed = commentMap.get(comment.id)!;

    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      // This is a reply - add to parent's replies
      const parent = commentMap.get(comment.parent_id)!;
      parent.replies = parent.replies || [];
      parent.replies.push(transformed);
    } else if (comment.depth === 0) {
      // Top-level comment
      topLevelComments.push(transformed);
    }
  }

  // Sort top-level by created_at descending (newest first)
  topLevelComments.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Sort replies by created_at ascending (oldest first)
  for (const comment of topLevelComments) {
    if (comment.replies) {
      comment.replies.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  }

  return topLevelComments;
}
