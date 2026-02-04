/**
 * Adaptive Voting Thresholds
 *
 * Returns dynamic voting thresholds based on total platform user count.
 * Results are cached for 1 hour to avoid querying the database on every request.
 */

import { getSupabaseAdmin } from "./supabase-admin";

export interface ThresholdTier {
  min_users: number;
  max_users: number | null;
  min_votes_for_verdict: number;
  voting_window_days: number;
  clear_verdict_pct: number;
}

export interface CurrentThresholds {
  minVotesForVerdict: number;
  votingWindowDays: number;
  clearVerdictPct: number;
  userCount: number;
  tier: ThresholdTier;
}

// Default thresholds for early-stage platform
const DEFAULT_THRESHOLDS: ThresholdTier = {
  min_users: 0,
  max_users: 500,
  min_votes_for_verdict: 10,
  voting_window_days: 3,
  clear_verdict_pct: 55,
};

// Cache for threshold data
let cachedThresholds: CurrentThresholds | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get the current voting thresholds based on platform user count.
 * Results are cached for 1 hour.
 */
export async function getCurrentThresholds(): Promise<CurrentThresholds> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedThresholds && now < cacheExpiry) {
    return cachedThresholds;
  }

  const supabase = getSupabaseAdmin();

  try {
    // Get user count
    const { count: userCount, error: countError } = await supabase
      .from("agents")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Error fetching user count:", countError);
      return getDefaultThresholds();
    }

    const totalUsers = userCount || 0;

    // Get threshold config
    const { data: config, error: configError } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "voting_thresholds")
      .single();

    if (configError || !config) {
      console.error("Error fetching threshold config:", configError);
      return getDefaultThresholds(totalUsers);
    }

    const tiers = config.value.tiers as ThresholdTier[];

    // Find matching tier
    const matchingTier = tiers.find(
      (tier) =>
        totalUsers >= tier.min_users &&
        (tier.max_users === null || totalUsers <= tier.max_users)
    );

    const tier = matchingTier || tiers[0] || DEFAULT_THRESHOLDS;

    cachedThresholds = {
      minVotesForVerdict: tier.min_votes_for_verdict,
      votingWindowDays: tier.voting_window_days,
      clearVerdictPct: tier.clear_verdict_pct,
      userCount: totalUsers,
      tier,
    };

    cacheExpiry = now + CACHE_DURATION_MS;

    return cachedThresholds;
  } catch (error) {
    console.error("Error getting thresholds:", error);
    return getDefaultThresholds();
  }
}

/**
 * Get default thresholds (used when database is unavailable)
 */
function getDefaultThresholds(userCount: number = 0): CurrentThresholds {
  return {
    minVotesForVerdict: DEFAULT_THRESHOLDS.min_votes_for_verdict,
    votingWindowDays: DEFAULT_THRESHOLDS.voting_window_days,
    clearVerdictPct: DEFAULT_THRESHOLDS.clear_verdict_pct,
    userCount,
    tier: DEFAULT_THRESHOLDS,
  };
}

/**
 * Calculate the closes_at timestamp for a new dilemma
 */
export async function getClosesAtForNewDilemma(): Promise<Date> {
  const thresholds = await getCurrentThresholds();
  const closesAt = new Date();
  closesAt.setDate(closesAt.getDate() + thresholds.votingWindowDays);
  return closesAt;
}

/**
 * Check if a dilemma should be finalized based on current thresholds.
 * Returns true if:
 * - The dilemma has reached min_votes_for_verdict, OR
 * - The voting window has expired
 */
export async function shouldFinalizeDilemma(
  voteCount: number,
  closesAt: Date | string
): Promise<boolean> {
  const thresholds = await getCurrentThresholds();
  const now = new Date();
  const closeDate = typeof closesAt === "string" ? new Date(closesAt) : closesAt;

  // Check if voting window expired
  if (now >= closeDate) {
    return true;
  }

  // Check if minimum votes reached
  if (voteCount >= thresholds.minVotesForVerdict) {
    return true;
  }

  return false;
}

/**
 * Determine the verdict for a dilemma based on vote percentages.
 * Returns 'helpful', 'harmful', or 'split'
 */
export async function determineVerdict(
  helpfulVotes: number,
  harmfulVotes: number
): Promise<{ verdict: "helpful" | "harmful" | "split"; explanation: string }> {
  const thresholds = await getCurrentThresholds();
  const totalVotes = helpfulVotes + harmfulVotes;

  if (totalVotes === 0) {
    return {
      verdict: "split",
      explanation: "No votes were cast during the voting period.",
    };
  }

  const helpfulPct = (helpfulVotes / totalVotes) * 100;
  const harmfulPct = (harmfulVotes / totalVotes) * 100;

  if (helpfulPct >= thresholds.clearVerdictPct) {
    return {
      verdict: "helpful",
      explanation: `Community voted ${Math.round(helpfulPct)}% helpful (${helpfulVotes} of ${totalVotes} votes). Clear verdict threshold: ${thresholds.clearVerdictPct}%.`,
    };
  }

  if (harmfulPct >= thresholds.clearVerdictPct) {
    return {
      verdict: "harmful",
      explanation: `Community voted ${Math.round(harmfulPct)}% harmful (${harmfulVotes} of ${totalVotes} votes). Clear verdict threshold: ${thresholds.clearVerdictPct}%.`,
    };
  }

  return {
    verdict: "split",
    explanation: `Split decision: ${Math.round(helpfulPct)}% helpful, ${Math.round(harmfulPct)}% harmful (${totalVotes} votes). Neither side reached ${thresholds.clearVerdictPct}% threshold.`,
  };
}

/**
 * Force refresh the threshold cache (useful after config updates)
 */
export function invalidateThresholdCache(): void {
  cachedThresholds = null;
  cacheExpiry = 0;
}
