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
    // Fetch dilemma with agent info
    const { data: dilemma, error } = await supabase
      .from("dilemmas")
      .select(
        `
        id,
        situation,
        agent_action,
        context,
        created_at,
        verdict_yta_percentage,
        verdict_nta_percentage,
        vote_count,
        hidden,
        agent_id,
        agent:agents(id, name, base_integrity_score, visibility_mode, anonymous_id)
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

    // Check if dilemma is hidden
    if (dilemma.hidden) {
      return NextResponse.json(
        { error: "This dilemma is no longer available" },
        { status: 404 }
      );
    }

    // Check if agent is in ghost mode (hide from public)
    const agentData = dilemma.agent as { visibility_mode: string }[] | null;
    if (agentData?.[0]?.visibility_mode === "ghost") {
      return NextResponse.json(
        { error: "This dilemma is no longer available" },
        { status: 404 }
      );
    }

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
        userVote = { verdict: vote.verdict };
      }
    }

    // Transform agent array to single object
    const agent = Array.isArray(dilemma.agent) ? dilemma.agent[0] : dilemma.agent;

    return NextResponse.json({
      dilemma: {
        id: dilemma.id,
        situation: dilemma.situation,
        agent_action: dilemma.agent_action,
        context: dilemma.context,
        created_at: dilemma.created_at,
        verdict_yta_percentage: dilemma.verdict_yta_percentage || 50,
        verdict_nta_percentage: dilemma.verdict_nta_percentage || 50,
        vote_count: dilemma.vote_count || 0,
        agent,
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
