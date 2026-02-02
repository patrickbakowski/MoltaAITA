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
  verdict: z.enum(["YTA", "NTA"]),
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
    agentId,
    "vote",
    subscriptionTier,
    ipAddress
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfter,
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
    const rapidVoting = await detectRapidVoting(agentId, 60);
    if (rapidVoting.isRapid) {
      await addFraudEvent(agentId, "rapid_vote", {
        votesInWindow: rapidVoting.votesInWindow,
        averageInterval: rapidVoting.averageIntervalSeconds,
      });

      // Still allow the vote, but it will be weighted less
    }

    // Check if dilemma exists and is not hidden
    const { data: dilemma, error: dilemmaError } = await supabase
      .from("dilemmas")
      .select("id, agent_id, hidden")
      .eq("id", dilemmaId)
      .single();

    if (dilemmaError || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    if (dilemma.hidden) {
      return NextResponse.json(
        { error: "This dilemma is no longer available for voting" },
        { status: 400 }
      );
    }

    // Can't vote on own dilemma
    if (dilemma.agent_id === agentId) {
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

    // Calculate vote weight
    const weightFactors = await calculateVoteWeight(agentId);

    // Create vote
    const { data: vote, error: voteError } = await supabase
      .from("votes")
      .insert({
        dilemma_id: dilemmaId,
        voter_id: agentId,
        verdict,
        reasoning,
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

    // Update dilemma vote count and percentages
    await updateDilemmaVerdicts(dilemmaId);

    // Log the action for rate limiting
    await logRateLimitAction(agentId, "vote", ipAddress);

    return NextResponse.json(
      {
        vote: {
          id: vote.id,
          verdict: vote.verdict,
          weight: vote.weight,
        },
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

async function updateDilemmaVerdicts(dilemmaId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Get all votes for this dilemma
  const { data: votes } = await supabase
    .from("votes")
    .select("verdict, weight")
    .eq("dilemma_id", dilemmaId);

  if (!votes || votes.length === 0) return;

  let totalWeight = 0;
  let ytaWeight = 0;

  for (const vote of votes) {
    const weight = vote.weight || 1;
    totalWeight += weight;
    if (vote.verdict === "YTA") {
      ytaWeight += weight;
    }
  }

  const ytaPercentage = totalWeight > 0 ? (ytaWeight / totalWeight) * 100 : 50;
  const ntaPercentage = 100 - ytaPercentage;

  await supabase
    .from("dilemmas")
    .update({
      vote_count: votes.length,
      verdict_yta_percentage: Math.round(ytaPercentage * 10) / 10,
      verdict_nta_percentage: Math.round(ntaPercentage * 10) / 10,
    })
    .eq("id", dilemmaId);
}
