import { getSupabaseAdmin } from "./supabase-admin";

export type FraudEventType =
  | "rapid_vote"
  | "vote_pattern_match"
  | "failed_captcha"
  | "duplicate_device"
  | "blacklisted_email"
  | "suspicious_timing";

// Fraud score deltas by event type
const FRAUD_SCORE_DELTAS: Record<FraudEventType, number> = {
  rapid_vote: 5, // Vote completed in under 5 seconds
  vote_pattern_match: 30, // Same vote pattern as another agent (80%+ match)
  failed_captcha: 10, // Failed CAPTCHA verification
  duplicate_device: 20, // Same device fingerprint on another account
  blacklisted_email: 15, // Attempted signup with blacklisted email
  suspicious_timing: 5, // Suspicious timing patterns
};

const AUTO_BAN_THRESHOLD = 80;

export interface FraudCheckResult {
  isFraudulent: boolean;
  currentScore: number;
  shouldBan: boolean;
  events: FraudEventType[];
}

/**
 * Add a fraud event and update agent's fraud score
 */
export async function addFraudEvent(
  agentId: string,
  eventType: FraudEventType,
  metadata?: Record<string, unknown>
): Promise<{ newScore: number; banned: boolean }> {
  const supabase = getSupabaseAdmin();
  const scoreDelta = FRAUD_SCORE_DELTAS[eventType];

  // Get current fraud score
  const { data: agent } = await supabase
    .from("agents")
    .select("fraud_score, banned")
    .eq("id", agentId)
    .single();

  if (!agent) {
    throw new Error("Agent not found");
  }

  const previousScore = agent.fraud_score || 0;
  const newScore = Math.max(0, previousScore + scoreDelta);
  const shouldBan = newScore >= AUTO_BAN_THRESHOLD && !agent.banned;

  // Insert fraud event
  await supabase.from("fraud_events").insert({
    agent_id: agentId,
    event_type: eventType,
    score_delta: scoreDelta,
    previous_score: previousScore,
    new_score: newScore,
    metadata: metadata || {},
  });

  // Update agent's fraud score
  const updateData: Record<string, unknown> = {
    fraud_score: newScore,
  };

  if (shouldBan) {
    updateData.banned = true;
    updateData.ban_reason = `Auto-banned: fraud score exceeded threshold (${newScore})`;
    updateData.banned_at = new Date().toISOString();
  }

  await supabase.from("agents").update(updateData).eq("id", agentId);

  return { newScore, banned: shouldBan };
}

/**
 * Check if a device fingerprint exists on another account
 */
export async function checkDuplicateDevice(
  fingerprint: string,
  currentAgentId: string
): Promise<{ isDuplicate: boolean; otherAgents: string[] }> {
  const supabase = getSupabaseAdmin();

  const { data: existingDevices } = await supabase
    .from("device_fingerprints")
    .select("agent_id, agents!inner(id, name)")
    .eq("fingerprint", fingerprint)
    .neq("agent_id", currentAgentId);

  if (!existingDevices || existingDevices.length === 0) {
    return { isDuplicate: false, otherAgents: [] };
  }

  const otherAgents = existingDevices.map((d) => d.agent_id);
  return { isDuplicate: true, otherAgents };
}

/**
 * Record device fingerprint for an agent
 */
export async function recordDeviceFingerprint(
  fingerprint: string,
  agentId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ isDuplicate: boolean; flagged: boolean }> {
  const supabase = getSupabaseAdmin();

  // Check for duplicates first
  const { isDuplicate, otherAgents } = await checkDuplicateDevice(fingerprint, agentId);

  // Upsert device fingerprint record
  const { data: existing } = await supabase
    .from("device_fingerprints")
    .select("id, ip_addresses, user_agents")
    .eq("fingerprint", fingerprint)
    .eq("agent_id", agentId)
    .single();

  if (existing) {
    // Update existing record
    const ipAddresses = existing.ip_addresses || [];
    const userAgents = existing.user_agents || [];

    if (ipAddress && !ipAddresses.includes(ipAddress)) {
      ipAddresses.push(ipAddress);
    }
    if (userAgent && !userAgents.includes(userAgent)) {
      userAgents.push(userAgent);
    }

    await supabase
      .from("device_fingerprints")
      .update({
        last_seen_at: new Date().toISOString(),
        ip_addresses: ipAddresses,
        user_agents: userAgents,
      })
      .eq("id", existing.id);
  } else {
    // Insert new record
    await supabase.from("device_fingerprints").insert({
      fingerprint,
      agent_id: agentId,
      ip_addresses: ipAddress ? [ipAddress] : [],
      user_agents: userAgent ? [userAgent] : [],
    });
  }

  // If duplicate, flag both accounts
  let flagged = false;
  if (isDuplicate) {
    // Add fraud event to current agent
    await addFraudEvent(agentId, "duplicate_device", {
      other_agents: otherAgents,
      fingerprint: fingerprint.substring(0, 10) + "...",
    });

    // Add fraud event to other agents
    for (const otherId of otherAgents) {
      await addFraudEvent(otherId, "duplicate_device", {
        other_agents: [agentId],
        fingerprint: fingerprint.substring(0, 10) + "...",
      });
    }

    flagged = true;
  }

  return { isDuplicate, flagged };
}

/**
 * Check vote timing for suspicious behavior
 */
export async function checkVoteTiming(
  agentId: string,
  timeOnDilemmaSeconds: number
): Promise<{ isSuspicious: boolean; isHighConfidence: boolean }> {
  const isSuspicious = timeOnDilemmaSeconds < 5;
  const isHighConfidence = timeOnDilemmaSeconds >= 30;

  if (isSuspicious) {
    await addFraudEvent(agentId, "rapid_vote", {
      time_on_dilemma: timeOnDilemmaSeconds,
    });
  }

  return { isSuspicious, isHighConfidence };
}

/**
 * Check agent's current fraud status
 */
export async function checkFraudStatus(agentId: string): Promise<{
  score: number;
  banned: boolean;
  banReason?: string;
}> {
  const supabase = getSupabaseAdmin();

  const { data: agent } = await supabase
    .from("agents")
    .select("fraud_score, banned, ban_reason")
    .eq("id", agentId)
    .single();

  if (!agent) {
    throw new Error("Agent not found");
  }

  return {
    score: agent.fraud_score || 0,
    banned: agent.banned || false,
    banReason: agent.ban_reason,
  };
}

/**
 * Get recent fraud events for an agent
 */
export async function getFraudEvents(
  agentId: string,
  limit: number = 10
): Promise<Array<{
  event_type: FraudEventType;
  score_delta: number;
  created_at: string;
  metadata: Record<string, unknown>;
}>> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("fraud_events")
    .select("event_type, score_delta, created_at, metadata")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as Array<{
    event_type: FraudEventType;
    score_delta: number;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
}

/**
 * Manually review and clear a fraud flag
 */
export async function reviewFraudEvent(
  eventId: string,
  result: "confirmed" | "false_positive" | "inconclusive"
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from("fraud_events")
    .update({
      reviewed: true,
      reviewed_at: new Date().toISOString(),
      review_result: result,
    })
    .eq("id", eventId);
}

/**
 * Unban an agent (manual admin action)
 */
export async function unbanAgent(
  agentId: string,
  resetFraudScore: boolean = false
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updateData: Record<string, unknown> = {
    banned: false,
    ban_reason: null,
    banned_at: null,
  };

  if (resetFraudScore) {
    updateData.fraud_score = 0;
  }

  await supabase.from("agents").update(updateData).eq("id", agentId);
}
