import { getSupabaseAdmin } from "./supabase-admin";

export type ActionType = "signup" | "dilemma" | "vote" | "jury" | "audit" | "verify_phone";

interface RateLimitConfig {
  limit: number;
  windowMinutes: number;
}

// Rate limits by action type and subscription tier
const RATE_LIMITS: Record<ActionType, { free: RateLimitConfig; incognito: RateLimitConfig }> = {
  signup: {
    free: { limit: 3, windowMinutes: 24 * 60 }, // 3 per day per IP
    incognito: { limit: 3, windowMinutes: 24 * 60 }, // Same for signups
  },
  dilemma: {
    free: { limit: 1, windowMinutes: 24 * 60 }, // 1 per day
    incognito: { limit: 3, windowMinutes: 24 * 60 }, // 3 per day
  },
  vote: {
    free: { limit: 10, windowMinutes: 24 * 60 }, // 10 per day
    incognito: { limit: 50, windowMinutes: 24 * 60 }, // 50 per day
  },
  jury: {
    free: { limit: 5, windowMinutes: 24 * 60 }, // 5 per day
    incognito: { limit: 20, windowMinutes: 24 * 60 }, // 20 per day
  },
  audit: {
    free: { limit: 1, windowMinutes: 90 * 24 * 60 }, // 1 per 90 days
    incognito: { limit: 1, windowMinutes: 90 * 24 * 60 }, // Same
  },
  verify_phone: {
    free: { limit: 5, windowMinutes: 60 }, // 5 attempts per hour
    incognito: { limit: 5, windowMinutes: 60 }, // Same
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Check if action is within rate limits
 */
export async function checkRateLimit(
  actionType: ActionType,
  identifier: string, // IP address or agent ID
  subscriptionTier: "free" | "incognito" = "free"
): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const config = RATE_LIMITS[actionType][subscriptionTier];

  // For incognito users on IP-based limits (like signup), use agent ID instead
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  // Count recent actions
  const { count, error } = await supabase
    .from("rate_limit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action_type", actionType)
    .eq("identifier", identifier)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("Rate limit check error:", error);
    // Fail open on error
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000),
      limit: config.limit,
    };
  }

  const currentCount = count || 0;
  const remaining = Math.max(0, config.limit - currentCount);
  const resetAt = new Date(Date.now() + config.windowMinutes * 60 * 1000);

  return {
    allowed: currentCount < config.limit,
    remaining,
    resetAt,
    limit: config.limit,
  };
}

/**
 * Log a rate-limited action
 */
export async function logRateLimitAction(
  actionType: ActionType,
  identifier: string,
  agentId?: string,
  ipAddress?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase.from("rate_limit_logs").insert({
    action_type: actionType,
    identifier,
    agent_id: agentId,
    ip_address: ipAddress,
    metadata: metadata || {},
  });
}

/**
 * Check rate limit and log action if allowed
 * Returns RateLimitResult with allowed=false if limit exceeded
 */
export async function checkAndLogRateLimit(
  actionType: ActionType,
  identifier: string,
  agentId?: string,
  ipAddress?: string,
  subscriptionTier: "free" | "incognito" = "free",
  metadata?: Record<string, unknown>
): Promise<RateLimitResult> {
  const result = await checkRateLimit(actionType, identifier, subscriptionTier);

  if (result.allowed) {
    await logRateLimitAction(actionType, identifier, agentId, ipAddress, metadata);
    // Update remaining after logging
    result.remaining = Math.max(0, result.remaining - 1);
  }

  return result;
}

/**
 * Get remaining rate limit for display
 */
export async function getRemainingLimits(
  agentId: string,
  ipAddress: string,
  subscriptionTier: "free" | "incognito" = "free"
): Promise<Record<ActionType, number>> {
  const actions: ActionType[] = ["dilemma", "vote", "jury"];
  const results: Record<string, number> = {};

  for (const action of actions) {
    // Use agent ID for authenticated actions
    const identifier = action === "signup" ? ipAddress : agentId;
    const result = await checkRateLimit(action, identifier, subscriptionTier);
    results[action] = result.remaining;
  }

  return results as Record<ActionType, number>;
}

/**
 * Detect rapid voting (more than 5 votes in 60 seconds)
 */
export async function detectRapidVoting(agentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const { count } = await supabase
    .from("rate_limit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action_type", "vote")
    .eq("agent_id", agentId)
    .gte("created_at", oneMinuteAgo.toISOString());

  return (count || 0) >= 5;
}

/**
 * Generate rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(result.resetAt.getTime() / 1000).toString(),
    ...(result.allowed ? {} : { "Retry-After": Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString() }),
  };
}
