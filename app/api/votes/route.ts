import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, logRateLimitAction, detectRapidVoting } from "@/lib/rate-limit";
import { calculateVoteWeight } from "@/lib/vote-weight";
import { addFraudEvent } from "@/lib/fraud";
import { z } from "zod";

const castVoteSchema = z.object({
  dilemmaId: z.string().uuid(),
  verdict: z.enum(["yta", "nta", "esh", "nah"]),
  reasoning: z.string().max(500).optional(),
  hcaptchaToken: z.string().optional(),
});

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

  // Check rate limit
  const subscriptionTier = session.user.subscriptionTier || "free";
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  const rateLimitResult = await checkRateLimit(
    "vote",
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
    const parsed = castVoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { dilemmaId, verdict, reasoning } = parsed.data;

    // Check for rapid voting (potential bot)
    const isRapidVoting = await detectRapidVoting(agentId);
    if (isRapidVoting) {
      await addFraudEvent(agentId, "rapid_vote", {});
      // Still allow the vote, but it will be weighted less
    }

    // Check if dilemma exists and is still open for voting
    const { data: dilemma, error: dilemmaError } = await supabase
      .from("agent_dilemmas")
      .select("id, submitter_id, status")
      .eq("id", dilemmaId)
      .single();

    if (dilemmaError || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    if (dilemma.status !== "active") {
      return NextResponse.json(
        { error: "This dilemma is no longer open for voting" },
        { status: 400 }
      );
    }

    // Can't vote on own dilemma (check submitter_id regardless of anonymous status)
    if (dilemma.submitter_id === agentId) {
      return NextResponse.json(
        { error: "You cannot vote on your own dilemma" },
        { status: 400 }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("dilemma_id", dilemmaId)
      .eq("voter_id", agentId)
      .single();

    if (existingVote) {
      return NextResponse.json(
        { error: "You have already voted on this dilemma" },
        { status: 400 }
      );
    }

    // Get voter's account type (human or agent)
    const { data: voter } = await supabase
      .from("agents")
      .select("account_type")
      .eq("id", agentId)
      .single();

    const voterType = voter?.account_type === "agent" ? "agent" : "human";

    // Calculate vote weight
    const weightFactors = await calculateVoteWeight(agentId);

    // Create vote
    const { data: vote, error: voteError } = await supabase
      .from("votes")
      .insert({
        dilemma_id: dilemmaId,
        voter_id: agentId,
        verdict: verdict.toLowerCase(),
        reasoning,
        voter_type: voterType,
        weight: weightFactors.finalWeight,
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (voteError) {
      console.error("Error creating vote:", voteError);
      return NextResponse.json(
        { error: "Failed to cast vote" },
        { status: 500 }
      );
    }

    // The database trigger will automatically update dilemma stats
    // and close if threshold is met

    // Log the action for rate limiting
    await logRateLimitAction("vote", agentId, agentId, ipAddress);

    // Check if the dilemma was just closed (to notify user)
    const { data: updatedDilemma } = await supabase
      .from("agent_dilemmas")
      .select("status, final_verdict")
      .eq("id", dilemmaId)
      .single();

    return NextResponse.json(
      {
        vote: {
          id: vote.id,
          verdict: vote.verdict,
          weight: vote.weight,
        },
        dilemmaStatus: updatedDilemma?.status,
        finalVerdict: updatedDilemma?.final_verdict,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Vote casting error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user has voted and get current threshold info
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const dilemmaId = searchParams.get("dilemmaId");

  if (!dilemmaId) {
    return NextResponse.json(
      { error: "dilemmaId is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    // Get dilemma info
    const { data: dilemma, error: dilemmaError } = await supabase
      .from("agent_dilemmas")
      .select("id, status, vote_count, closing_threshold, final_verdict")
      .eq("id", dilemmaId)
      .single();

    if (dilemmaError || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    // Check if user has voted
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

    // Get current threshold (for display purposes)
    const { data: thresholdData } = await supabase
      .rpc("calculate_closing_threshold");

    return NextResponse.json({
      hasVoted: userVote !== null,
      userVote,
      dilemmaStatus: dilemma.status,
      voteCount: dilemma.vote_count || 0,
      closingThreshold: dilemma.closing_threshold || thresholdData || 5,
      finalVerdict: dilemma.final_verdict,
    });
  } catch (err) {
    console.error("Error checking vote status:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
