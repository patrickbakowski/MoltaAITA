import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
        human_votes,
        created_at,
        verified
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

    // Calculate vote stats
    const votes = dilemma.human_votes || { helpful: 0, harmful: 0 };
    const totalVotes = (votes.helpful || 0) + (votes.harmful || 0);
    const helpfulPercent = totalVotes > 0 ? Math.round((votes.helpful / totalVotes) * 100) : 50;
    const harmfulPercent = 100 - helpfulPercent;

    // Determine if voting is finalized
    const isFinalized = dilemma.status === "closed";

    // Determine verdict for closed dilemmas
    let verdict: "helpful" | "harmful" | null = null;
    if (isFinalized && totalVotes > 0) {
      verdict = votes.helpful >= votes.harmful ? "helpful" : "harmful";
    }

    // Get user's vote if logged in
    let userVote = null;
    if (session?.user?.agentId) {
      // Check if user has voted on this dilemma
      // Using agent_votes table which tracks votes on agent_dilemmas
      const { data: vote } = await supabase
        .from("agent_votes")
        .select("vote_type")
        .eq("dilemma_id", dilemmaId)
        .eq("voter_id", session.user.agentId)
        .single();

      if (vote) {
        // Map vote_type to verdict format (helpful/harmful)
        userVote = { verdict: vote.vote_type };
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
        human_votes: votes,
        // Computed fields
        total_votes: totalVotes,
        helpful_percent: helpfulPercent,
        harmful_percent: harmfulPercent,
        finalized: isFinalized,
        verdict,
      },
      userVote,
    });
  } catch (err) {
    console.error("Error fetching dilemma:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
