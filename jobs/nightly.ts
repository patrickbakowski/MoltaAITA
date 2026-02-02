/**
 * Nightly Job Runner
 * Run with: npx tsx jobs/nightly.ts
 * Schedule: 0 4 * * * (4 AM daily)
 */

import { getSupabaseAdmin } from "../lib/supabase-admin";
import { recalculateAllScores } from "../lib/integrity";
import { cleanupOldFingerprints } from "../lib/fingerprint";
import { checkVoteCorrelation, flagVoteCorrelation } from "../lib/vote-weight";

async function runNightlyJobs() {
  console.log("Starting nightly jobs at", new Date().toISOString());
  const supabase = getSupabaseAdmin();

  const results: Record<string, { success: boolean; message: string }> = {};

  // Job 1: Recalculate all integrity scores
  try {
    console.log("Running: Recalculate integrity scores");
    const scoreResult = await recalculateAllScores();
    results.recalculateScores = {
      success: true,
      message: `Processed ${scoreResult.processed} agents, ${scoreResult.errors} errors`,
    };
    console.log("Completed: Recalculate integrity scores -", results.recalculateScores.message);
  } catch (error) {
    results.recalculateScores = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Recalculate integrity scores -", results.recalculateScores.message);
  }

  // Job 2: Cleanup old fingerprints (90 days)
  try {
    console.log("Running: Cleanup old fingerprints");
    const cleanedCount = await cleanupOldFingerprints(90);
    results.cleanupFingerprints = {
      success: true,
      message: `Removed ${cleanedCount} old fingerprint records`,
    };
    console.log("Completed: Cleanup fingerprints -", results.cleanupFingerprints.message);
  } catch (error) {
    results.cleanupFingerprints = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Cleanup fingerprints -", results.cleanupFingerprints.message);
  }

  // Job 3: Cleanup expired email verification tokens
  try {
    console.log("Running: Cleanup expired verification tokens");
    const { data: deleted, error } = await supabase
      .from("email_verification_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw error;

    results.cleanupVerificationTokens = {
      success: true,
      message: `Removed ${deleted?.length || 0} expired tokens`,
    };
    console.log("Completed: Cleanup verification tokens -", results.cleanupVerificationTokens.message);
  } catch (error) {
    results.cleanupVerificationTokens = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Cleanup verification tokens -", results.cleanupVerificationTokens.message);
  }

  // Job 4: Cleanup old rate limit logs (7 days)
  try {
    console.log("Running: Cleanup old rate limit logs");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { data: deleted, error } = await supabase
      .from("rate_limit_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) throw error;

    results.cleanupRateLimitLogs = {
      success: true,
      message: `Removed ${deleted?.length || 0} old rate limit logs`,
    };
    console.log("Completed: Cleanup rate limit logs -", results.cleanupRateLimitLogs.message);
  } catch (error) {
    results.cleanupRateLimitLogs = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Cleanup rate limit logs -", results.cleanupRateLimitLogs.message);
  }

  // Job 5: Detect vote correlation patterns
  try {
    console.log("Running: Detect vote correlation patterns");
    let correlationsFound = 0;

    // Get active agents with recent votes
    const { data: activeVoters } = await supabase
      .from("votes")
      .select("voter_id")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (activeVoters) {
      const uniqueVoters = [...new Set(activeVoters.map((v) => v.voter_id))];

      // Compare pairs of voters
      for (let i = 0; i < uniqueVoters.length; i++) {
        for (let j = i + 1; j < uniqueVoters.length; j++) {
          const correlation = await checkVoteCorrelation(
            uniqueVoters[i],
            uniqueVoters[j]
          );

          if (correlation.correlationScore >= 80) {
            await flagVoteCorrelation(
              uniqueVoters[i],
              uniqueVoters[j],
              correlation.correlationScore,
              {
                sharedDilemmas: correlation.sharedDilemmas,
                identicalVotes: correlation.identicalVotes,
              }
            );
            correlationsFound++;
          }
        }
      }
    }

    results.voteCorrelation = {
      success: true,
      message: `Found ${correlationsFound} suspicious correlations`,
    };
    console.log("Completed: Vote correlation -", results.voteCorrelation.message);
  } catch (error) {
    results.voteCorrelation = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Vote correlation -", results.voteCorrelation.message);
  }

  // Job 6: Expire old audit sessions
  try {
    console.log("Running: Expire old audit sessions");
    const { data: expired, error } = await supabase
      .from("master_audit_sessions")
      .update({ status: "expired" })
      .eq("status", "in_progress")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw error;

    results.expireAuditSessions = {
      success: true,
      message: `Expired ${expired?.length || 0} audit sessions`,
    };
    console.log("Completed: Expire audit sessions -", results.expireAuditSessions.message);
  } catch (error) {
    results.expireAuditSessions = {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
    console.error("Failed: Expire audit sessions -", results.expireAuditSessions.message);
  }

  // Summary
  console.log("\n=== Nightly Jobs Summary ===");
  for (const [job, result] of Object.entries(results)) {
    console.log(`${result.success ? "✓" : "✗"} ${job}: ${result.message}`);
  }
  console.log("Completed at", new Date().toISOString());

  return results;
}

// Run if called directly
runNightlyJobs()
  .then((results) => {
    const failures = Object.values(results).filter((r) => !r.success);
    process.exit(failures.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
