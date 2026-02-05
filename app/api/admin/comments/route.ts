import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const dilemmaId = searchParams.get("dilemma_id");
  const hidden = searchParams.get("hidden");

  try {
    let query = supabase
      .from("dilemma_comments")
      .select(`
        id,
        dilemma_id,
        author_id,
        parent_id,
        content,
        is_ghost_comment,
        ghost_display_name,
        depth,
        hidden,
        created_at,
        author:agents!author_id(id, name, email, account_type),
        dilemma:agent_dilemmas!dilemma_id(id, agent_name, dilemma_text)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (dilemmaId) {
      query = query.eq("dilemma_id", dilemmaId);
    }
    if (hidden === "true") {
      query = query.eq("hidden", true);
    } else if (hidden === "false") {
      query = query.eq("hidden", false);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error("Admin comments fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    // Transform the joined data
    const transformedComments = (comments || []).map((c: Record<string, unknown>) => ({
      ...c,
      author: Array.isArray(c.author) ? c.author[0] : c.author,
      dilemma: Array.isArray(c.dilemma) ? c.dilemma[0] : c.dilemma,
    }));

    return NextResponse.json({ comments: transformedComments });
  } catch (err) {
    console.error("Admin comments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { id, action } = await request.json();

    if (!id || !action) {
      return NextResponse.json({ error: "ID and action required" }, { status: 400 });
    }

    if (action === "hide") {
      await supabase
        .from("dilemma_comments")
        .update({ hidden: true })
        .eq("id", id);
    } else if (action === "unhide") {
      await supabase
        .from("dilemma_comments")
        .update({ hidden: false })
        .eq("id", id);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin comment action error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    }

    // First delete any replies to this comment
    await supabase
      .from("dilemma_comments")
      .delete()
      .eq("parent_id", id);

    // Then delete the comment itself
    const { error } = await supabase
      .from("dilemma_comments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete comment error:", error);
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin comment delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
