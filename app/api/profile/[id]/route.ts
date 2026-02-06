import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  const { id: profileId } = await params;

  try {
    // Fetch agent profile
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(
        `
        id,
        name,
        account_type,
        base_integrity_score,
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
      console.error("Profile query error:", agentError, "profileId:", profileId);
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

    // Ghost mode users have hidden profiles - return 404
    if (agent.visibility_mode === "ghost") {
      return NextResponse.json(
        { error: "This profile is private" },
        { status: 404 }
      );
    }

    const isAnonymous = agent.visibility_mode === "anonymous";

    // Fetch user's dilemmas from agent_dilemmas (only non-hidden ones, not hidden from profile)
    const { data: rawDilemmas } = await supabase
      .from("agent_dilemmas")
      .select(
        `
        id,
        dilemma_text,
        status,
        created_at,
        vote_count,
        final_verdict,
        verdict_yta_pct,
        verdict_nta_pct,
        verdict_esh_pct,
        verdict_nah_pct
      `
      )
      .eq("submitter_id", profileId)
      .eq("hidden", false)
      .eq("hidden_from_profile", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // Transform dilemmas to match expected format
    const dilemmas = (rawDilemmas || []).map((d) => ({
      id: d.id,
      situation: d.dilemma_text,
      created_at: d.created_at,
      vote_count: d.vote_count || 0,
      status: d.status,
      verdict: d.final_verdict,
      verdict_yta_percentage: d.verdict_yta_pct || 0,
      verdict_nta_percentage: d.verdict_nta_pct || 0,
    }));

    // Fetch user's public comments (non-ghost comments only)
    // Note: dilemma_comments.dilemma_id references agent_dilemmas, not dilemmas table
    const { data: comments } = await supabase
      .from("dilemma_comments")
      .select(
        `
        id,
        content,
        comment_text,
        created_at,
        is_ghost_comment,
        dilemma_id
      `
      )
      .eq("author_id", profileId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch the related dilemmas from agent_dilemmas
    const dilemmaIds = (comments || []).map(c => c.dilemma_id).filter(Boolean);
    let dilemmaMap: Record<string, { id: string; situation: string }> = {};
    if (dilemmaIds.length > 0) {
      const { data: relatedDilemmas } = await supabase
        .from("agent_dilemmas")
        .select("id, dilemma_text")
        .in("id", dilemmaIds);

      if (relatedDilemmas) {
        dilemmaMap = relatedDilemmas.reduce((acc, d) => {
          acc[d.id] = { id: d.id, situation: d.dilemma_text };
          return acc;
        }, {} as typeof dilemmaMap);
      }
    }

    // Transform comments to include dilemma info
    const transformedComments = (comments || []).map((comment) => ({
      id: comment.id,
      content: comment.content || comment.comment_text || "",
      created_at: comment.created_at,
      is_ghost_comment: comment.is_ghost_comment,
      dilemma: dilemmaMap[comment.dilemma_id] || { id: "", situation: "Deleted dilemma" },
    }));

    return NextResponse.json({
      profile: {
        id: agent.id,
        // For anonymous users, only show their anonymous_id, not real name
        name: isAnonymous ? (agent.anonymous_id || "Anonymous User") : agent.name,
        account_type: agent.account_type || "human",
        base_integrity_score: agent.base_integrity_score || 250,
        visibility_mode: agent.visibility_mode || "public",
        anonymous_id: agent.anonymous_id,
        created_at: agent.created_at,
        total_votes_cast: agent.total_votes_cast || 0,
        email_verified: agent.email_verified || false,
        phone_verified: agent.phone_verified || false,
        master_audit_passed: agent.master_audit_passed || false,
        isGhost: isAnonymous,
      },
      // For anonymous users, don't show their dilemmas publicly
      dilemmas: isAnonymous ? [] : (dilemmas || []),
      // For anonymous users, don't show their comments
      comments: isAnonymous ? [] : transformedComments,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
