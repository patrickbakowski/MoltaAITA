import twilio from "twilio";
import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";

// Initialize Twilio client lazily
let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error("Missing Twilio environment variables");
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Hash phone number for storage (one-way)
 */
export function hashPhoneNumber(phoneNumber: string): string {
  // Normalize phone number first
  const normalized = normalizePhoneNumber(phoneNumber);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US/Canada if no country code
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    }
  }

  return normalized;
}

/**
 * Check if phone number is already used by another agent
 */
export async function isPhoneUsed(phoneNumber: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const phoneHash = hashPhoneNumber(phoneNumber);

  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("phone_hash", phoneHash)
    .single();

  return !!data;
}

/**
 * Lookup phone number type to reject VoIP/virtual numbers
 */
export async function lookupPhoneType(phoneNumber: string): Promise<{
  isValid: boolean;
  isVoip: boolean;
  carrier?: string;
  type?: string;
  error?: string;
}> {
  try {
    const client = getTwilioClient();
    const normalized = normalizePhoneNumber(phoneNumber);

    const lookup = await client.lookups.v2
      .phoneNumbers(normalized)
      .fetch({ fields: "line_type_intelligence" });

    const lineType = lookup.lineTypeIntelligence?.type;
    const carrier = lookup.lineTypeIntelligence?.carrierName;

    // Reject VoIP and virtual numbers
    const isVoip = lineType === "voip" || lineType === "virtual";

    return {
      isValid: true,
      isVoip,
      carrier: carrier || undefined,
      type: lineType || undefined,
    };
  } catch (error) {
    console.error("Phone lookup error:", error);
    return {
      isValid: false,
      isVoip: false,
      error: error instanceof Error ? error.message : "Lookup failed",
    };
  }
}

/**
 * Start phone verification process
 */
export async function startPhoneVerification(
  agentId: string,
  phoneNumber: string,
  ipAddress?: string
): Promise<{
  success: boolean;
  verificationSid?: string;
  error?: string;
}> {
  const supabase = getSupabaseAdmin();
  const client = getTwilioClient();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!verifyServiceSid) {
    return { success: false, error: "Verification service not configured" };
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  const phoneHash = hashPhoneNumber(phoneNumber);

  // Check if phone is already used
  if (await isPhoneUsed(phoneNumber)) {
    return { success: false, error: "This phone number is already registered" };
  }

  // Check phone type (reject VoIP)
  const lookupResult = await lookupPhoneType(phoneNumber);
  if (!lookupResult.isValid) {
    return { success: false, error: lookupResult.error || "Invalid phone number" };
  }
  if (lookupResult.isVoip) {
    return { success: false, error: "VoIP and virtual phone numbers are not allowed" };
  }

  try {
    // Start Twilio verification
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: normalized,
        channel: "sms",
      });

    // Record the attempt
    await supabase.from("phone_verification_attempts").insert({
      agent_id: agentId,
      phone_number_hash: phoneHash,
      verification_sid: verification.sid,
      status: "pending",
      ip_address: ipAddress,
    });

    return {
      success: true,
      verificationSid: verification.sid,
    };
  } catch (error) {
    console.error("Phone verification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Confirm phone verification code
 */
export async function confirmPhoneVerification(
  agentId: string,
  verificationSid: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = getSupabaseAdmin();
  const client = getTwilioClient();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!verifyServiceSid) {
    return { success: false, error: "Verification service not configured" };
  }

  // Get the verification attempt
  const { data: attempt } = await supabase
    .from("phone_verification_attempts")
    .select("phone_number_hash, attempts")
    .eq("verification_sid", verificationSid)
    .eq("agent_id", agentId)
    .eq("status", "pending")
    .single();

  if (!attempt) {
    return { success: false, error: "Verification not found or expired" };
  }

  // Increment attempt count
  await supabase
    .from("phone_verification_attempts")
    .update({ attempts: (attempt.attempts || 0) + 1 })
    .eq("verification_sid", verificationSid);

  // Check max attempts (5)
  if ((attempt.attempts || 0) >= 5) {
    await supabase
      .from("phone_verification_attempts")
      .update({ status: "failed" })
      .eq("verification_sid", verificationSid);
    return { success: false, error: "Too many attempts. Please start over." };
  }

  try {
    // Verify with Twilio
    // Note: Need to get the phone number to verify
    const { data: verificationData } = await supabase
      .from("phone_verification_attempts")
      .select("phone_number_hash")
      .eq("verification_sid", verificationSid)
      .single();

    // Check the verification status
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        verificationSid,
        code,
      });

    if (verificationCheck.status === "approved") {
      // Update attempt status
      await supabase
        .from("phone_verification_attempts")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("verification_sid", verificationSid);

      // Update agent with verified phone
      await supabase
        .from("agents")
        .update({
          phone_verified: true,
          phone_hash: attempt.phone_number_hash,
        })
        .eq("id", agentId);

      return { success: true };
    } else {
      return { success: false, error: "Invalid code" };
    }
  } catch (error) {
    console.error("Verification check error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Check if agent has verified phone
 */
export async function hasVerifiedPhone(agentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("agents")
    .select("phone_verified")
    .eq("id", agentId)
    .single();

  return data?.phone_verified || false;
}
