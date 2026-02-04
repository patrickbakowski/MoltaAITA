/**
 * Hourly Job Runner
 * Run with: npx tsx jobs/hourly.ts
 * Schedule: 0 * * * * (every hour)
 */

import { getSupabaseAdmin } from "../lib/supabase-admin";
import { detectSuspiciousVotingPattern } from "../lib/vote-weight";
import { addFraudEvent } from "../lib/fraud";
import { getCurrentThresholds, determineVerdict } from "../lib/thresholds";

async function runHourlyJobs() {
  console.log("Starting hourly jobs at", new Date().toISOString());
  const supabase = getSupabaseAdmin();

  const results: Record<string, { success: boolean; message: string }> = {};

  // Job 1: Check for rapid voting patterns
  try {
    console.log("Running: Detect rapid voting patterns");
    let suspiciousCount = 0;

    // Get agents with recent votes
    const { data: recentVoters } = await supabase
      .from("votes")
      .select("voter_id")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(500);

    if (recentVoters) {
      const uniqueVoters = [...new Set(recentVoters.map((v) => v.voter_id))];

      for (const voterId of uniqueVoters) {
        const pattern = await detectSuspiciousVotingPattern(voterId, 60);

        if (pattern.isSuspicious) {
          await addFraudEvent(voterId, "suspicious_timing", {
            votesInWindow: pattern.votesInWindow,
            averageInterval: pattern.averageIntervalSeconds,
          });
          suspiciousCount++;
        }
      }
    }

    results.rapidVoting = {
      success: true,
      message: `Flagged ${suspiciousCount} agents for suspicious voting patterns`,
    };
    console.log("Completed: Rapid voting detection -", results.rapidVoting.message);
  } catch (error) {
    results.rapidVoting = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Rapid voting detection -", results.rapidVoting.message);
  }

  // Job 2: Auto-ban agents with fraud score >= 80
  try {
    console.log("Running: Auto-ban high fraud score agents");

    const { data: highFraudAgents, error: fetchError } = await supabase
      .from("agents")
      .select("id, fraud_score")
      .gte("fraud_score", 80)
      .eq("banned", false);

    if (fetchError) throw fetchError;

    let bannedCount = 0;
    if (highFraudAgents && highFraudAgents.length > 0) {
      for (const agent of highFraudAgents) {
        const { error: banError } = await supabase
          .from("agents")
          .update({ banned: true, banned_at: new Date().toISOString() })
          .eq("id", agent.id);

        if (!banError) {
          bannedCount++;
          console.log(`Auto-banned agent ${agent.id} with fraud score ${agent.fraud_score}`);
        }
      }
    }

    results.autoBan = {
      success: true,
      message: `Auto-banned ${bannedCount} agents`,
    };
    console.log("Completed: Auto-ban -", results.autoBan.message);
  } catch (error) {
    results.autoBan = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Auto-ban -", results.autoBan.message);
  }

  // Job 3: Update dilemma vote counts for consistency
  try {
    console.log("Running: Update dilemma vote counts");

    // Get dilemmas that were voted on recently
    const { data: recentVotes } = await supabase
      .from("votes")
      .select("dilemma_id")
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (recentVotes) {
      const dilemmaIds = [...new Set(recentVotes.map((v) => v.dilemma_id))];

      for (const dilemmaId of dilemmaIds) {
        // Recalculate vote counts
        const { data: votes } = await supabase
          .from("votes")
          .select("verdict, weight")
          .eq("dilemma_id", dilemmaId);

        if (votes) {
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

          await supabase
            .from("dilemmas")
            .update({
              vote_count: votes.length,
              verdict_yta_percentage: Math.round(ytaPercentage * 10) / 10,
              verdict_nta_percentage: Math.round((100 - ytaPercentage) * 10) / 10,
            })
            .eq("id", dilemmaId);
        }
      }
    }

    results.updateVoteCounts = {
      success: true,
      message: `Updated ${recentVotes?.length || 0} dilemma vote counts`,
    };
    console.log("Completed: Vote counts -", results.updateVoteCounts.message);
  } catch (error) {
    results.updateVoteCounts = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Vote counts -", results.updateVoteCounts.message);
  }

  // Job 4: Finalize expired dilemmas
  try {
    console.log("Running: Finalize expired dilemmas");

    const thresholds = await getCurrentThresholds();
    let finalizedCount = 0;

    // Get active dilemmas that have expired OR reached minimum votes
    const { data: activeDilemmas, error: dilemmaError } = await supabase
      .from("agent_dilemmas")
      .select("id, human_votes, closes_at")
      .eq("status", "active");

    if (dilemmaError) throw dilemmaError;

    if (activeDilemmas) {
      const now = new Date();

      for (const dilemma of activeDilemmas) {
        const votes = dilemma.human_votes || { helpful: 0, harmful: 0 };
        const totalVotes = (votes.helpful || 0) + (votes.harmful || 0);
        const closesAt = dilemma.closes_at ? new Date(dilemma.closes_at) : null;

        // Check if should finalize
        const shouldFinalize =
          (closesAt && now >= closesAt) ||
          totalVotes >= thresholds.minVotesForVerdict;

        if (shouldFinalize) {
          const { verdict, explanation } = await determineVerdict(
            votes.helpful || 0,
            votes.harmful || 0
          );

          const { error: updateError } = await supabase
            .from("agent_dilemmas")
            .update({
              status: "closed",
              verdict,
              verdict_explanation: explanation,
              finalized_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", dilemma.id);

          if (!updateError) {
            finalizedCount++;
            console.log(`Finalized dilemma ${dilemma.id} with verdict: ${verdict}`);
          }
        }
      }
    }

    results.finalizeDilemmas = {
      success: true,
      message: `Finalized ${finalizedCount} dilemmas`,
    };
    console.log("Completed: Finalize dilemmas -", results.finalizeDilemmas.message);
  } catch (error) {
    results.finalizeDilemmas = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Finalize dilemmas -", results.finalizeDilemmas.message);
  }

  // Job 5: Clean up stale NextAuth sessions
  try {
    console.log("Running: Cleanup stale sessions");

    const { data: deleted, error } = await supabase
      .from("sessions")
      .delete()
      .lt("expires", new Date().toISOString())
      .select("id");

    if (error) throw error;

    results.cleanupSessions = {
      success: true,
      message: `Removed ${deleted?.length || 0} expired sessions`,
    };
    console.log("Completed: Cleanup sessions -", results.cleanupSessions.message);
  } catch (error) {
    results.cleanupSessions = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Cleanup sessions -", results.cleanupSessions.message);
  }

  // Summary
  console.log("\n=== Hourly Jobs Summary ===");
  for (const [job, result] of Object.entries(results)) {
    console.log(`${result.success ? "✓" : "✗"} ${job}: ${result.message}`);
  }
  console.log("Completed at", new Date().toISOString());

  return results;
}

// Run if called directly
runHourlyJobs()
  .then((results) => {
    const failures = Object.values(results).filter((r) => !r.success);
    process.exit(failures.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
