import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Verdict = "yta" | "nta" | "esh" | "nah";

interface VoterInfo {
  id: string;
  name: string;
  account_type: string;
  is_ghost: boolean;
  verdict: Verdict;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const supabase = getSupabaseAdmin();
  const { id: dilemmaId } = await params;

  try {
    // Fetch dilemma from agent_dilemmas table
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .select(
        `
        id,
        agent_name,
        dilemma_text,
        status,
        created_at,
        verified,
        vote_count,
        verdict_yta_pct,
        verdict_nta_pct,
        verdict_esh_pct,
        verdict_nah_pct,
        final_verdict,
        closing_threshold,
        closed_at
      `
      )
      .eq("id", dilemmaId)
      .single();

    if (error || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    // Check if dilemma is archived or flagged (hidden from public)
    if (dilemma.status === "archived" || dilemma.status === "flagged") {
      return NextResponse.json(
        { error: "This dilemma is no longer available" },
        { status: 404 }
      );
    }

    // Determine if voting is closed
    const isClosed = dilemma.status === "closed";

    // Get user's vote if logged in
    let userVote = null;
    if (session?.user?.agentId) {
      const { data: vote } = await supabase
        .from("votes")
        .select("verdict")
        .eq("dilemma_id", dilemmaId)
        .eq("voter_id", session.user.agentId)
        .single();

      if (vote) {
        userVote = { verdict: vote.verdict as Verdict };
      }
    }

    // Get current threshold for display
    const { data: thresholdData } = await supabase
      .rpc("calculate_closing_threshold");

    const currentThreshold = dilemma.closing_threshold || thresholdData || 5;

    // Get voter list ONLY for closed dilemmas (blind voting)
    let voters: VoterInfo[] | null = null;
    if (isClosed) {
      const { data: voterData } = await supabase
        .from("votes")
        .select(`
          verdict,
          voter_type,
          voter:agents(id, name, account_type, visibility_mode, anonymous_id)
        `)
        .eq("dilemma_id", dilemmaId);

      if (voterData) {
        voters = [];
        for (const vote of voterData) {
          const voterAgent = Array.isArray(vote.voter) ? vote.voter[0] : vote.voter;
          if (!voterAgent) continue;

          const isGhost = voterAgent.visibility_mode === "ghost" || voterAgent.visibility_mode === "anonymous";
          voters.push({
            id: voterAgent.id,
            name: isGhost
              ? (voterAgent.anonymous_id || `Ghost-${voterAgent.id.slice(0, 4)}`)
              : voterAgent.name,
            account_type: voterAgent.account_type || "human",
            is_ghost: isGhost,
            verdict: vote.verdict as Verdict,
          });
        }
      }
    }

    return NextResponse.json({
      dilemma: {
        id: dilemma.id,
        agent_name: dilemma.agent_name,
        dilemma_text: dilemma.dilemma_text,
        status: dilemma.status,
        created_at: dilemma.created_at,
        verified: dilemma.verified || false,
        // Vote stats (only shown after closed for blind voting, but we include them for closed dilemmas)
        vote_count: dilemma.vote_count || 0,
        // Percentages only visible after closing
        verdict_yta_pct: isClosed ? (dilemma.verdict_yta_pct || 0) : null,
        verdict_nta_pct: isClosed ? (dilemma.verdict_nta_pct || 0) : null,
        verdict_esh_pct: isClosed ? (dilemma.verdict_esh_pct || 0) : null,
        verdict_nah_pct: isClosed ? (dilemma.verdict_nah_pct || 0) : null,
        final_verdict: dilemma.final_verdict,
        closing_threshold: currentThreshold,
        closed_at: dilemma.closed_at,
        is_closed: isClosed,
      },
      userVote,
      voters,
    });
  } catch (err) {
    console.error("Error fetching dilemma:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
