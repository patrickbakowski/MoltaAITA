import { getSupabaseAdmin } from "./supabase-admin";

/**
 * Vote weight calculation factors
 */
interface VoteWeightFactors {
  // Base weight for the agent
  baseWeight: number;
  // Account age factor (0.5 to 1.5)
  ageFactor: number;
  // Verification factor (1.0 to 2.0)
  verificationFactor: number;
  // Consistency factor based on voting patterns (0.5 to 1.5)
  consistencyFactor: number;
  // Fraud penalty (0 to 1.0, where 1.0 = no penalty)
  fraudPenalty: number;
  // Final calculated weight
  finalWeight: number;
}

/**
 * Calculate vote weight for an agent
 * Weight determines how much impact their vote has on verdicts
 */
export async function calculateVoteWeight(agentId: string): Promise<VoteWeightFactors> {
  const supabase = getSupabaseAdmin();

  // Get agent data
  const { data: agent } = await supabase
    .from("agents")
    .select("created_at, email_verified, phone_verified, fraud_score, subscription_tier")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return {
      baseWeight: 1.0,
      ageFactor: 1.0,
      verificationFactor: 1.0,
      consistencyFactor: 1.0,
      fraudPenalty: 1.0,
      finalWeight: 1.0,
    };
  }

  // Base weight - incognito subscribers get a slight boost
  const baseWeight = agent.subscription_tier === "incognito" ? 1.2 : 1.0;

  // Age factor - older accounts get more weight (up to 90 days)
  const accountAge = Math.floor(
    (Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const ageFactor = Math.min(0.5 + (accountAge / 90) * 1.0, 1.5);

  // Verification factor
  let verificationFactor = 1.0;
  if (agent.email_verified) verificationFactor += 0.3;
  if (agent.phone_verified) verificationFactor += 0.7;

  // Get voting consistency
  const consistencyFactor = await calculateConsistencyFactor(agentId);

  // Fraud penalty - scales with fraud score
  // 0 fraud score = 1.0, 50+ fraud score = 0.5, 80+ = 0
  let fraudPenalty = 1.0;
  if (agent.fraud_score >= 80) {
    fraudPenalty = 0;
  } else if (agent.fraud_score > 0) {
    fraudPenalty = Math.max(0.5, 1.0 - (agent.fraud_score / 100));
  }

  // Calculate final weight
  const finalWeight =
    baseWeight * ageFactor * verificationFactor * consistencyFactor * fraudPenalty;

  return {
    baseWeight,
    ageFactor,
    verificationFactor,
    consistencyFactor,
    fraudPenalty,
    finalWeight,
  };
}

/**
 * Calculate voting consistency factor
 * Agents who vote consistently with community consensus get higher weights
 */
async function calculateConsistencyFactor(agentId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Get agent's recent votes and compare to final verdicts
  const { data: votes } = await supabase
    .from("votes")
    .select(`
      verdict,
      dilemma:dilemmas(verdict_yta_percentage)
    `)
    .eq("voter_id", agentId)
    .not("dilemma.verdict_yta_percentage", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!votes || votes.length < 10) {
    // Not enough data, return neutral factor
    return 1.0;
  }

  let alignedVotes = 0;
  for (const vote of votes) {
    const dilemma = vote.dilemma as { verdict_yta_percentage: number } | null;
    if (!dilemma) continue;

    const communityYta = dilemma.verdict_yta_percentage > 50;
    const voterYta = vote.verdict === "YTA";

    if (communityYta === voterYta) {
      alignedVotes++;
    }
  }

  const alignmentRate = alignedVotes / votes.length;

  // Convert alignment rate to factor (0.5 to 1.5)
  // 50% alignment = 1.0, 100% = 1.5, 0% = 0.5
  return 0.5 + alignmentRate;
}

/**
 * Detect suspicious voting timing patterns
 */
export async function detectSuspiciousVotingPattern(
  agentId: string,
  windowMinutes: number = 60
): Promise<{
  isSuspicious: boolean;
  votesInWindow: number;
  averageIntervalSeconds: number;
}> {
  const supabase = getSupabaseAdmin();

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  const { data: recentVotes } = await supabase
    .from("votes")
    .select("created_at")
    .eq("voter_id", agentId)
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: true });

  if (!recentVotes || recentVotes.length < 3) {
    return {
      isSuspicious: false,
      votesInWindow: recentVotes?.length || 0,
      averageIntervalSeconds: 0,
    };
  }

  // Calculate intervals between votes
  const intervals: number[] = [];
  for (let i = 1; i < recentVotes.length; i++) {
    const interval =
      (new Date(recentVotes[i].created_at).getTime() -
        new Date(recentVotes[i - 1].created_at).getTime()) /
      1000;
    intervals.push(interval);
  }

  const averageInterval =
    intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

  // Check for mechanical voting (very consistent intervals)
  const intervalVariance =
    intervals.reduce((sum, i) => sum + Math.pow(i - averageInterval, 2), 0) /
    intervals.length;
  const standardDeviation = Math.sqrt(intervalVariance);

  // Suspicious if:
  // 1. Average interval < 5 seconds (too fast)
  // 2. Standard deviation < 2 seconds (too consistent, suggests automation)
  // 3. More than 20 votes in an hour
  const isSuspicious =
    averageInterval < 5 ||
    (standardDeviation < 2 && recentVotes.length > 5) ||
    recentVotes.length > 20;

  return {
    isSuspicious,
    votesInWindow: recentVotes.length,
    averageIntervalSeconds: averageInterval,
  };
}

/**
 * Check for vote correlation between agents
 * Detects sockpuppet accounts voting together
 */
export async function checkVoteCorrelation(
  agentId1: string,
  agentId2: string
): Promise<{
  correlationScore: number;
  sharedDilemmas: number;
  identicalVotes: number;
}> {
  const supabase = getSupabaseAdmin();

  // Get votes from both agents on same dilemmas
  const { data: votes1 } = await supabase
    .from("votes")
    .select("dilemma_id, verdict, created_at")
    .eq("voter_id", agentId1);

  const { data: votes2 } = await supabase
    .from("votes")
    .select("dilemma_id, verdict, created_at")
    .eq("voter_id", agentId2);

  if (!votes1 || !votes2) {
    return {
      correlationScore: 0,
      sharedDilemmas: 0,
      identicalVotes: 0,
    };
  }

  // Create maps for efficient lookup
  const votes1Map = new Map(
    votes1.map((v) => [v.dilemma_id, { verdict: v.verdict, time: v.created_at }])
  );
  const votes2Map = new Map(
    votes2.map((v) => [v.dilemma_id, { verdict: v.verdict, time: v.created_at }])
  );

  // Find shared dilemmas
  const sharedDilemmas = [...votes1Map.keys()].filter((id) =>
    votes2Map.has(id)
  );

  if (sharedDilemmas.length < 5) {
    return {
      correlationScore: 0,
      sharedDilemmas: sharedDilemmas.length,
      identicalVotes: 0,
    };
  }

  // Count identical votes and similar timing
  let identicalVotes = 0;
  let timingMatches = 0;

  for (const dilemmaId of sharedDilemmas) {
    const v1 = votes1Map.get(dilemmaId)!;
    const v2 = votes2Map.get(dilemmaId)!;

    if (v1.verdict === v2.verdict) {
      identicalVotes++;
    }

    // Check if votes were within 5 minutes of each other
    const timeDiff = Math.abs(
      new Date(v1.time).getTime() - new Date(v2.time).getTime()
    );
    if (timeDiff < 5 * 60 * 1000) {
      timingMatches++;
    }
  }

  // Calculate correlation score (0 to 100)
  const identicalRate = identicalVotes / sharedDilemmas.length;
  const timingRate = timingMatches / sharedDilemmas.length;

  // Weight identical votes more heavily than timing
  const correlationScore = Math.min(
    100,
    identicalRate * 70 + timingRate * 30
  ) * (sharedDilemmas.length >= 10 ? 1 : 0.5);

  return {
    correlationScore,
    sharedDilemmas: sharedDilemmas.length,
    identicalVotes,
  };
}

/**
 * Flag potential vote correlation for review
 */
export async function flagVoteCorrelation(
  agentId1: string,
  agentId2: string,
  correlationScore: number,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase.from("vote_correlation_flags").insert({
    agent_id_1: agentId1,
    agent_id_2: agentId2,
    correlation_score: correlationScore,
    metadata,
  });
}
