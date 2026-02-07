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

    // Update dilemma vote stats directly (don't rely on database trigger)
    // This updates vote_count, verdict percentages, and JSONB breakdown
    try {
      // Get all votes for this dilemma to calculate stats
      const { data: allVotes, error: votesError } = await supabase
        .from("votes")
        .select("verdict, weight, voter_type")
        .eq("dilemma_id", dilemmaId);

      if (votesError) {
        console.error("Error fetching votes for stats:", votesError);
      } else if (allVotes) {
        const voteCount = allVotes.length;

        // Calculate weighted totals for each verdict
        let totalWeight = 0;
        let ytaWeight = 0;
        let ntaWeight = 0;
        let eshWeight = 0;
        let nahWeight = 0;

        // Also track raw counts for JSONB breakdown
        const humanVotes = { yta: 0, nta: 0, esh: 0, nah: 0 };
        const agentVotes = { yta: 0, nta: 0, esh: 0, nah: 0 };

        for (const v of allVotes) {
          const weight = v.weight || 1;
          totalWeight += weight;

          const verdictLower = v.verdict.toLowerCase() as "yta" | "nta" | "esh" | "nah";

          switch (verdictLower) {
            case "yta": ytaWeight += weight; break;
            case "nta": ntaWeight += weight; break;
            case "esh": eshWeight += weight; break;
            case "nah": nahWeight += weight; break;
          }

          // Track breakdown by voter type
          if (v.voter_type === "agent") {
            agentVotes[verdictLower]++;
          } else {
            humanVotes[verdictLower]++;
          }
        }

        // Calculate percentages
        const ytaPct = totalWeight > 0 ? Math.round((ytaWeight / totalWeight) * 1000) / 10 : 0;
        const ntaPct = totalWeight > 0 ? Math.round((ntaWeight / totalWeight) * 1000) / 10 : 0;
        const eshPct = totalWeight > 0 ? Math.round((eshWeight / totalWeight) * 1000) / 10 : 0;
        const nahPct = totalWeight > 0 ? Math.round((nahWeight / totalWeight) * 1000) / 10 : 0;

        // Get current dynamic threshold
        const { data: thresholdData } = await supabase.rpc("calculate_closing_threshold");
        const threshold = thresholdData || 5;

        // Determine if we should close and calculate final verdict
        let finalVerdict: string | null = null;
        let shouldClose = false;

        if (voteCount >= threshold) {
          shouldClose = true;
          const maxPct = Math.max(ytaPct, ntaPct, eshPct, nahPct);

          // Check for ties (within 1% is considered tied)
          const closeVerdicts = [
            { verdict: "yta", pct: ytaPct },
            { verdict: "nta", pct: ntaPct },
            { verdict: "esh", pct: eshPct },
            { verdict: "nah", pct: nahPct },
          ].filter(v => v.pct >= maxPct - 1);

          if (closeVerdicts.length > 1) {
            finalVerdict = "split";
          } else if (ytaPct === maxPct) {
            finalVerdict = "yta";
          } else if (ntaPct === maxPct) {
            finalVerdict = "nta";
          } else if (eshPct === maxPct) {
            finalVerdict = "esh";
          } else {
            finalVerdict = "nah";
          }
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          vote_count: voteCount,
          verdict_yta_pct: ytaPct,
          verdict_nta_pct: ntaPct,
          verdict_esh_pct: eshPct,
          verdict_nah_pct: nahPct,
          human_votes: humanVotes,
          closing_threshold: threshold,
          updated_at: new Date().toISOString(),
        };

        if (shouldClose) {
          updateData.status = "closed";
          updateData.final_verdict = finalVerdict;
          updateData.closed_at = new Date().toISOString();
        }

        // Update the dilemma
        const { error: updateError } = await supabase
          .from("agent_dilemmas")
          .update(updateData)
          .eq("id", dilemmaId);

        if (updateError) {
          console.error("Error updating dilemma stats:", updateError);
        }
      }
    } catch (statsError) {
      console.error("Error updating vote stats:", statsError);
      // Don't fail the vote if stats update fails
    }

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
