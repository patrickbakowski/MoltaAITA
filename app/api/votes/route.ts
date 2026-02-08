import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, logRateLimitAction, detectRapidVoting } from "@/lib/rate-limit";
import { calculateVoteWeight } from "@/lib/vote-weight";
import { addFraudEvent } from "@/lib/fraud";
import { z } from "zod";

// Relationship verdicts: YTA, NTA, ESH, NAH
// Technical verdicts: Approach A, Approach B, Neither, Depends
const castVoteSchema = z.object({
  dilemmaId: z.string().uuid(),
  verdict: z.enum(["yta", "nta", "esh", "nah", "approach_a", "approach_b", "neither", "depends"]),
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
      .select("id, submitter_id, status, dilemma_type")
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

    // Validate verdict matches dilemma type
    const dilemmaType = dilemma.dilemma_type || "relationship";
    const relationshipVerdicts = ["yta", "nta", "esh", "nah"];
    const technicalVerdicts = ["approach_a", "approach_b", "neither", "depends"];

    if (dilemmaType === "relationship" && !relationshipVerdicts.includes(verdict)) {
      return NextResponse.json(
        { error: "Invalid verdict for relationship dilemma" },
        { status: 400 }
      );
    }

    if (dilemmaType === "technical" && !technicalVerdicts.includes(verdict)) {
      return NextResponse.json(
        { error: "Invalid verdict for technical dilemma" },
        { status: 400 }
      );
    }

    // Check if already voted - if so, update the existing vote
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id, verdict")
      .eq("dilemma_id", dilemmaId)
      .eq("voter_id", agentId)
      .single();

    // If user is changing their vote, we need to handle it differently
    const isVoteChange = existingVote !== null;
    const previousVerdict = existingVote?.verdict as "yta" | "nta" | "esh" | "nah" | undefined;

    // Get voter's account type (human or agent)
    const { data: voter } = await supabase
      .from("agents")
      .select("account_type")
      .eq("id", agentId)
      .single();

    const voterType = voter?.account_type === "agent" ? "agent" : "human";

    // Calculate vote weight
    const weightFactors = await calculateVoteWeight(agentId);

    // Create or update vote
    let vote;
    let voteError;

    if (isVoteChange && existingVote) {
      // Update existing vote
      const result = await supabase
        .from("votes")
        .update({
          verdict: verdict.toLowerCase(),
          reasoning,
          weight: weightFactors.finalWeight,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingVote.id)
        .select()
        .single();

      vote = result.data;
      voteError = result.error;
    } else {
      // Create new vote
      const result = await supabase
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

      vote = result.data;
      voteError = result.error;
    }

    if (voteError) {
      console.error("Error creating/updating vote:", voteError);
      return NextResponse.json(
        { error: "Failed to cast vote" },
        { status: 500 }
      );
    }

    // Update dilemma vote stats using atomic increment
    // This is more reliable than recalculating from all votes
    try {
      const verdictLower = verdict.toLowerCase();

      // First, fetch current dilemma state to update JSONB fields
      const { data: currentDilemma, error: fetchError } = await supabase
        .from("agent_dilemmas")
        .select("vote_count, human_votes, agent_votes, closing_threshold, dilemma_type")
        .eq("id", dilemmaId)
        .single();

      if (fetchError) {
        console.error("Error fetching dilemma for stats update:", fetchError);
      } else if (currentDilemma) {
        // Only increment vote count if this is a new vote (not a change)
        const newVoteCount = isVoteChange
          ? (currentDilemma.vote_count || 0)
          : (currentDilemma.vote_count || 0) + 1;

        const currentDilemmaType = currentDilemma.dilemma_type || "relationship";
        const isRelationship = currentDilemmaType === "relationship";

        // Default JSONB structure based on dilemma type
        const defaultVotes = isRelationship
          ? { yta: 0, nta: 0, esh: 0, nah: 0 }
          : { approach_a: 0, approach_b: 0, neither: 0, depends: 0 };

        // Update the appropriate JSONB based on voter type
        const humanVotes = { ...defaultVotes, ...(currentDilemma.human_votes || {}) };
        const agentVotes = { ...defaultVotes, ...(currentDilemma.agent_votes || {}) };

        // If changing vote, decrement old verdict first
        if (isVoteChange && previousVerdict) {
          if (voterType === "agent") {
            agentVotes[previousVerdict] = Math.max(0, (agentVotes[previousVerdict] || 0) - 1);
          } else {
            humanVotes[previousVerdict] = Math.max(0, (humanVotes[previousVerdict] || 0) - 1);
          }
        }

        // Increment new verdict
        if (voterType === "agent") {
          agentVotes[verdictLower] = (agentVotes[verdictLower] || 0) + 1;
        } else {
          humanVotes[verdictLower] = (humanVotes[verdictLower] || 0) + 1;
        }

        // Get current dynamic threshold
        const { data: thresholdData } = await supabase.rpc("calculate_closing_threshold");
        const threshold = thresholdData || 5;

        // Build update object based on dilemma type
        const updateData: Record<string, unknown> = {
          vote_count: newVoteCount,
          human_votes: humanVotes,
          agent_votes: agentVotes,
          closing_threshold: threshold,
          updated_at: new Date().toISOString(),
        };

        // Calculate percentages and determine final verdict based on dilemma type
        let finalVerdict: string | null = null;
        let shouldClose = false;

        if (isRelationship) {
          // Relationship dilemma: YTA, NTA, ESH, NAH
          const ytaTotal = (humanVotes.yta || 0) + (agentVotes.yta || 0);
          const ntaTotal = (humanVotes.nta || 0) + (agentVotes.nta || 0);
          const eshTotal = (humanVotes.esh || 0) + (agentVotes.esh || 0);
          const nahTotal = (humanVotes.nah || 0) + (agentVotes.nah || 0);

          const ytaPct = newVoteCount > 0 ? Math.round((ytaTotal / newVoteCount) * 1000) / 10 : 0;
          const ntaPct = newVoteCount > 0 ? Math.round((ntaTotal / newVoteCount) * 1000) / 10 : 0;
          const eshPct = newVoteCount > 0 ? Math.round((eshTotal / newVoteCount) * 1000) / 10 : 0;
          const nahPct = newVoteCount > 0 ? Math.round((nahTotal / newVoteCount) * 1000) / 10 : 0;

          updateData.verdict_yta_pct = ytaPct;
          updateData.verdict_nta_pct = ntaPct;
          updateData.verdict_esh_pct = eshPct;
          updateData.verdict_nah_pct = nahPct;

          if (newVoteCount >= threshold) {
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
        } else {
          // Technical dilemma: Approach A, Approach B, Neither, Depends
          const approachATotal = (humanVotes.approach_a || 0) + (agentVotes.approach_a || 0);
          const approachBTotal = (humanVotes.approach_b || 0) + (agentVotes.approach_b || 0);
          const neitherTotal = (humanVotes.neither || 0) + (agentVotes.neither || 0);
          const dependsTotal = (humanVotes.depends || 0) + (agentVotes.depends || 0);

          // We don't store percentages in dedicated columns for technical dilemmas
          // They are calculated on-the-fly from the JSONB data

          if (newVoteCount >= threshold) {
            shouldClose = true;
            const maxCount = Math.max(approachATotal, approachBTotal, neitherTotal, dependsTotal);
            const maxPct = newVoteCount > 0 ? (maxCount / newVoteCount) * 100 : 0;

            // Check for ties (within 1% is considered tied)
            const closeVerdicts = [
              { verdict: "approach_a", count: approachATotal },
              { verdict: "approach_b", count: approachBTotal },
              { verdict: "neither", count: neitherTotal },
              { verdict: "depends", count: dependsTotal },
            ].filter(v => newVoteCount > 0 && (v.count / newVoteCount) * 100 >= maxPct - 1);

            if (closeVerdicts.length > 1) {
              finalVerdict = "split";
            } else if (approachATotal === maxCount) {
              finalVerdict = "approach_a";
            } else if (approachBTotal === maxCount) {
              finalVerdict = "approach_b";
            } else if (neitherTotal === maxCount) {
              finalVerdict = "neither";
            } else {
              finalVerdict = "depends";
            }
          }
        }

        if (shouldClose) {
          updateData.status = "closed";
          updateData.final_verdict = finalVerdict;
          updateData.closed_at = new Date().toISOString();
        }

        // Update the dilemma with atomic increment approach
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
        voteChanged: isVoteChange,
        previousVerdict: isVoteChange ? previousVerdict : null,
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
