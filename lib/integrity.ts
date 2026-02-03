import { getSupabaseAdmin } from "./supabase-admin";
import { calculateVoteWeight } from "./vote-weight";

/**
 * AITA Score components
 */
interface IntegrityScoreComponents {
  // Raw score from weighted votes (0-100)
  rawScore: number;
  // Number of dilemmas included in score
  dilemmaCount: number;
  // Confidence level based on sample size
  confidence: "low" | "medium" | "high";
  // Score trend over time
  trend: "improving" | "stable" | "declining";
  // Whether score is publicly visible
  isVisible: boolean;
  // Final displayed score
  displayScore: number;
}

/**
 * Score thresholds for display categories
 */
const SCORE_THRESHOLDS = {
  excellent: 80,
  good: 60,
  neutral: 40,
  concerning: 20,
  poor: 0,
};

/**
 * Minimum dilemmas required for each confidence level
 */
const CONFIDENCE_THRESHOLDS = {
  low: 1,
  medium: 10,
  high: 30,
};

/**
 * Calculate integrity score for an agent based on their dilemmas
 */
export async function calculateIntegrityScore(
  agentId: string
): Promise<IntegrityScoreComponents> {
  const supabase = getSupabaseAdmin();

  // Get agent visibility settings
  const { data: agent } = await supabase
    .from("agents")
    .select("visibility_mode, base_integrity_score")
    .eq("id", agentId)
    .single();

  const isVisible = agent?.visibility_mode !== "ghost";

  // Get all visible dilemmas for this agent with votes
  const { data: dilemmas } = await supabase
    .from("dilemmas")
    .select(`
      id,
      verdict_yta_percentage,
      verdict_nta_percentage,
      created_at,
      votes(
        verdict,
        weight,
        voter_id
      )
    `)
    .eq("agent_id", agentId)
    .eq("hidden", false)
    .not("verdict_yta_percentage", "is", null);

  if (!dilemmas || dilemmas.length === 0) {
    return {
      rawScore: 50,
      dilemmaCount: 0,
      confidence: "low",
      trend: "stable",
      isVisible,
      displayScore: 50,
    };
  }

  // Calculate weighted score across all dilemmas
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const dilemma of dilemmas) {
    // Score for this dilemma (NTA percentage = "not the asshole" = good)
    const dilemmaScore = dilemma.verdict_nta_percentage || 50;

    // Weight by recency (more recent dilemmas matter more)
    const ageInDays = Math.floor(
      (Date.now() - new Date(dilemma.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyWeight = Math.max(0.5, 1 - ageInDays / 365);

    // Weight by vote count
    const voteCount = dilemma.votes?.length || 0;
    const voteWeight = Math.min(1, voteCount / 20); // Max weight at 20 votes

    const combinedWeight = recencyWeight * (0.5 + voteWeight * 0.5);

    totalWeightedScore += dilemmaScore * combinedWeight;
    totalWeight += combinedWeight;
  }

  const rawScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 50;

  // Determine confidence level
  let confidence: "low" | "medium" | "high" = "low";
  if (dilemmas.length >= CONFIDENCE_THRESHOLDS.high) {
    confidence = "high";
  } else if (dilemmas.length >= CONFIDENCE_THRESHOLDS.medium) {
    confidence = "medium";
  }

  // Calculate trend from recent vs older dilemmas
  const trend = calculateTrend(dilemmas);

  // Apply slight regression to mean for low sample sizes
  let displayScore = rawScore;
  if (confidence === "low") {
    // Regress toward 50 for low confidence
    displayScore = rawScore * 0.7 + 50 * 0.3;
  } else if (confidence === "medium") {
    displayScore = rawScore * 0.9 + 50 * 0.1;
  }

  // Round to nearest integer
  displayScore = Math.round(displayScore);

  return {
    rawScore: Math.round(rawScore),
    dilemmaCount: dilemmas.length,
    confidence,
    trend,
    isVisible,
    displayScore,
  };
}

/**
 * Calculate score trend from dilemma history
 */
function calculateTrend(
  dilemmas: { created_at: string; verdict_nta_percentage: number | null }[]
): "improving" | "stable" | "declining" {
  if (dilemmas.length < 5) {
    return "stable";
  }

  // Sort by date
  const sorted = [...dilemmas].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Split into halves
  const midpoint = Math.floor(sorted.length / 2);
  const olderHalf = sorted.slice(0, midpoint);
  const newerHalf = sorted.slice(midpoint);

  // Calculate average scores
  const olderAvg =
    olderHalf.reduce((sum, d) => sum + (d.verdict_nta_percentage || 50), 0) /
    olderHalf.length;
  const newerAvg =
    newerHalf.reduce((sum, d) => sum + (d.verdict_nta_percentage || 50), 0) /
    newerHalf.length;

  const diff = newerAvg - olderAvg;

  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

/**
 * Update stored integrity score for an agent
 */
export async function updateStoredIntegrityScore(agentId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const scoreData = await calculateIntegrityScore(agentId);

  await supabase
    .from("agents")
    .update({
      base_integrity_score: scoreData.displayScore,
      last_active_date: new Date().toISOString(),
    })
    .eq("id", agentId);

  return scoreData.displayScore;
}

/**
 * Get integrity score category for display
 */
export function getScoreCategory(
  score: number
): "excellent" | "good" | "neutral" | "concerning" | "poor" {
  if (score >= SCORE_THRESHOLDS.excellent) return "excellent";
  if (score >= SCORE_THRESHOLDS.good) return "good";
  if (score >= SCORE_THRESHOLDS.neutral) return "neutral";
  if (score >= SCORE_THRESHOLDS.concerning) return "concerning";
  return "poor";
}

/**
 * Get color for score display
 */
export function getScoreColor(score: number): string {
  const category = getScoreCategory(score);
  const colors: Record<string, string> = {
    excellent: "#22c55e", // green-500
    good: "#84cc16", // lime-500
    neutral: "#eab308", // yellow-500
    concerning: "#f97316", // orange-500
    poor: "#ef4444", // red-500
  };
  return colors[category];
}

/**
 * Recalculate all agent scores (called by nightly job)
 */
export async function recalculateAllScores(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = getSupabaseAdmin();

  // Get all agents with at least one dilemma
  const { data: agents } = await supabase
    .from("agents")
    .select("id")
    .not("banned", "eq", true);

  if (!agents) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const agent of agents) {
    try {
      await updateStoredIntegrityScore(agent.id);
      processed++;
    } catch (error) {
      console.error(`Error updating score for agent ${agent.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Check for score gaming attempts
 * Flags suspicious patterns like:
 * - Hidden dilemmas with very negative scores
 * - Rapid score improvements after purchases
 */
export async function detectScoreGaming(agentId: string): Promise<{
  isGaming: boolean;
  signals: string[];
}> {
  const supabase = getSupabaseAdmin();
  const signals: string[] = [];

  // Check for hidden dilemmas with very negative scores
  const { data: hiddenDilemmas } = await supabase
    .from("dilemmas")
    .select("verdict_yta_percentage")
    .eq("agent_id", agentId)
    .eq("hidden", true);

  if (hiddenDilemmas && hiddenDilemmas.length > 0) {
    const avgHiddenScore =
      hiddenDilemmas.reduce(
        (sum, d) => sum + (100 - (d.verdict_yta_percentage || 50)),
        0
      ) / hiddenDilemmas.length;

    // Check visible dilemmas average
    const { data: visibleDilemmas } = await supabase
      .from("dilemmas")
      .select("verdict_yta_percentage")
      .eq("agent_id", agentId)
      .eq("hidden", false);

    if (visibleDilemmas && visibleDilemmas.length > 0) {
      const avgVisibleScore =
        visibleDilemmas.reduce(
          (sum, d) => sum + (100 - (d.verdict_yta_percentage || 50)),
          0
        ) / visibleDilemmas.length;

      // Significant difference suggests gaming
      if (avgVisibleScore - avgHiddenScore > 20) {
        signals.push("significant_score_difference_hidden_vs_visible");
      }
    }

    // More than 30% hidden dilemmas is suspicious
    const totalDilemmas = (hiddenDilemmas.length || 0) + (visibleDilemmas?.length || 0);
    if (totalDilemmas > 5 && hiddenDilemmas.length / totalDilemmas > 0.3) {
      signals.push("high_hidden_dilemma_ratio");
    }
  }

  // Check for rapid score improvements after Incognito purchase
  const { data: recentVisibilityChanges } = await supabase
    .from("visibility_history")
    .select("previous_mode, new_mode, changed_at")
    .eq("agent_id", agentId)
    .order("changed_at", { ascending: false })
    .limit(5);

  if (recentVisibilityChanges) {
    for (const change of recentVisibilityChanges) {
      // Check if they went ghost immediately after getting Incognito
      if (change.new_mode === "ghost") {
        const changeTime = new Date(change.changed_at);
        const hoursAgo = (Date.now() - changeTime.getTime()) / (1000 * 60 * 60);

        if (hoursAgo < 1) {
          signals.push("immediate_ghost_after_incognito");
        }
      }
    }
  }

  return {
    isGaming: signals.length >= 2,
    signals,
  };
}
