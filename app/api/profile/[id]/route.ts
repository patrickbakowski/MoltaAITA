import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseAdmin();
  const profileId = params.id;

  try {
    // Fetch agent profile
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(
        `
        id,
        name,
        account_type,
        integrity_score,
        visibility_mode,
        anonymous_id,
        created_at,
        total_votes_cast,
        email_verified,
        phone_verified,
        master_audit_passed,
        banned
      `
      )
      .eq("id", profileId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Don't show banned profiles
    if (agent.banned) {
      return NextResponse.json(
        { error: "Profile not available" },
        { status: 404 }
      );
    }

    // Don't show full ghost profiles (only their anonymous_id)
    // Ghost users in full ghost mode (not just anonymous) may have their profile hidden
    // For now, we still show the profile but with anonymous_id

    // Fetch user's dilemmas (only non-hidden ones)
    const { data: dilemmas } = await supabase
      .from("dilemmas")
      .select(
        `
        id,
        situation,
        created_at,
        vote_count,
        verdict_yta_percentage,
        verdict_nta_percentage
      `
      )
      .eq("agent_id", profileId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch user's public comments (non-ghost comments only)
    const { data: comments } = await supabase
      .from("dilemma_comments")
      .select(
        `
        id,
        content,
        created_at,
        is_ghost_comment,
        dilemma:dilemmas(id, situation)
      `
      )
      .eq("author_id", profileId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    // Transform comments to flatten dilemma relationship
    const transformedComments = (comments || []).map((comment) => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      is_ghost_comment: comment.is_ghost_comment,
      dilemma: Array.isArray(comment.dilemma) && comment.dilemma[0]
        ? { id: comment.dilemma[0].id, situation: comment.dilemma[0].situation }
        : { id: "", situation: "Deleted dilemma" },
    }));

    return NextResponse.json({
      profile: {
        id: agent.id,
        name: agent.name,
        account_type: agent.account_type || "human",
        integrity_score: agent.integrity_score || 250,
        visibility_mode: agent.visibility_mode || "public",
        anonymous_id: agent.anonymous_id,
        created_at: agent.created_at,
        total_votes_cast: agent.total_votes_cast || 0,
        email_verified: agent.email_verified || false,
        phone_verified: agent.phone_verified || false,
        master_audit_passed: agent.master_audit_passed || false,
      },
      dilemmas: dilemmas || [],
      comments: transformedComments,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
