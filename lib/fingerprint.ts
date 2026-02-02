import { getSupabaseAdmin } from "./supabase-admin";
import { addFraudEvent, checkDuplicateDevice } from "./fraud";

/**
 * Device fingerprint data structure from FingerprintJS
 */
export interface DeviceFingerprint {
  visitorId: string;
  requestId?: string;
  confidence?: number;
  components?: {
    platform?: string;
    timezone?: string;
    screenResolution?: string;
    languages?: string[];
    colorDepth?: number;
    deviceMemory?: number;
    hardwareConcurrency?: number;
    webglVendor?: string;
    webglRenderer?: string;
  };
}

/**
 * Store device fingerprint for an agent
 */
export async function storeDeviceFingerprint(
  agentId: string,
  fingerprint: DeviceFingerprint,
  ipAddress?: string
): Promise<{
  success: boolean;
  isDuplicate: boolean;
  existingAgentId?: string;
}> {
  const supabase = getSupabaseAdmin();

  // Check if this fingerprint is already associated with another agent
  const isDuplicate = await checkDuplicateDevice(agentId, fingerprint.visitorId);

  if (isDuplicate) {
    // Get the existing agent ID for this fingerprint
    const { data: existing } = await supabase
      .from("device_fingerprints")
      .select("agent_id")
      .eq("fingerprint_hash", fingerprint.visitorId)
      .neq("agent_id", agentId)
      .single();

    if (existing) {
      // Add fraud event for duplicate device
      await addFraudEvent(agentId, "duplicate_device", {
        fingerprint: fingerprint.visitorId,
        existingAgentId: existing.agent_id,
      });

      return {
        success: false,
        isDuplicate: true,
        existingAgentId: existing.agent_id,
      };
    }
  }

  // Store the fingerprint
  await supabase.from("device_fingerprints").upsert(
    {
      agent_id: agentId,
      fingerprint_hash: fingerprint.visitorId,
      confidence: fingerprint.confidence || 0,
      components: fingerprint.components || {},
      ip_address: ipAddress,
      last_seen_at: new Date().toISOString(),
    },
    {
      onConflict: "agent_id,fingerprint_hash",
    }
  );

  return {
    success: true,
    isDuplicate: false,
  };
}

/**
 * Get all fingerprints for an agent
 */
export async function getAgentFingerprints(agentId: string): Promise<
  {
    fingerprintHash: string;
    confidence: number;
    lastSeenAt: string;
  }[]
> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("device_fingerprints")
    .select("fingerprint_hash, confidence, last_seen_at")
    .eq("agent_id", agentId)
    .order("last_seen_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((fp) => ({
    fingerprintHash: fp.fingerprint_hash,
    confidence: fp.confidence,
    lastSeenAt: fp.last_seen_at,
  }));
}

/**
 * Check if fingerprint confidence meets minimum threshold
 */
export function isConfidenceAcceptable(confidence: number): boolean {
  // FingerprintJS confidence scores range from 0 to 1
  // We require at least 0.5 confidence for fraud detection
  return confidence >= 0.5;
}

/**
 * Get agents sharing the same fingerprint
 */
export async function getAgentsSharingFingerprint(
  fingerprintHash: string
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("device_fingerprints")
    .select("agent_id")
    .eq("fingerprint_hash", fingerprintHash);

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.agent_id);
}

/**
 * Clean up old fingerprint records (called by nightly job)
 */
export async function cleanupOldFingerprints(daysOld: number = 90): Promise<number> {
  const supabase = getSupabaseAdmin();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await supabase
    .from("device_fingerprints")
    .delete()
    .lt("last_seen_at", cutoffDate.toISOString())
    .select("id");

  if (error) {
    console.error("Error cleaning up fingerprints:", error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Server-side fingerprint validation
 * Validates fingerprint data received from client
 */
export function validateFingerprint(fingerprint: unknown): fingerprint is DeviceFingerprint {
  if (!fingerprint || typeof fingerprint !== "object") {
    return false;
  }

  const fp = fingerprint as Record<string, unknown>;

  // Must have visitorId
  if (typeof fp.visitorId !== "string" || fp.visitorId.length === 0) {
    return false;
  }

  // Confidence must be a number if present
  if (fp.confidence !== undefined && typeof fp.confidence !== "number") {
    return false;
  }

  return true;
}
