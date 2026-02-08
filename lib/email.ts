import { Resend } from "resend";
import { getSupabaseAdmin } from "./supabase-admin";
import crypto from "crypto";

// Initialize Resend client lazily
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Normalize email address for uniqueness checking
 * - Lowercases everything
 * - For Gmail/Googlemail: removes dots and plus addressing
 */
export function normalizeEmail(email: string): string {
  email = email.toLowerCase().trim();

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  // Handle Gmail and Googlemail
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Remove everything after +
    const cleanLocal = localPart.split("+")[0];
    // Remove dots
    const noDots = cleanLocal.replace(/\./g, "");
    return `${noDots}@gmail.com`;
  }

  return email;
}

/**
 * Check if email domain is blacklisted
 */
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("email_domain_blacklist")
    .select("domain")
    .eq("domain", domain)
    .single();

  return !!data;
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create and store email verification token
 */
export async function createVerificationToken(
  agentId: string,
  expiresInHours: number = 24
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const { error } = await supabase.from("email_verification_tokens").insert({
    token,
    agent_id: agentId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error("Failed to create verification token");
  }

  return token;
}

/**
 * Verify email token and mark agent as verified
 */
export async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  error?: string;
  agentId?: string;
}> {
  const supabase = getSupabaseAdmin();

  // Find valid token
  const { data: tokenData, error: tokenError } = await supabase
    .from("email_verification_tokens")
    .select("agent_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (tokenError || !tokenData) {
    return { success: false, error: "Invalid verification token" };
  }

  if (tokenData.used_at) {
    return { success: false, error: "Token already used" };
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    return { success: false, error: "Token expired" };
  }

  // Mark token as used
  await supabase
    .from("email_verification_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  // Mark agent as verified
  const { error: updateError } = await supabase
    .from("agents")
    .update({ email_verified: true })
    .eq("id", tokenData.agent_id);

  if (updateError) {
    return { success: false, error: "Failed to verify email" };
  }

  return { success: true, agentId: tokenData.agent_id };
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const resend = getResend();
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: "AgentDilemma <noreply@agentdilemma.com>",
    to: email,
    subject: "Verify your email - AgentDilemma",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #f5f5f5;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111;">Verify your email</h1>
            <p style="margin: 0 0 24px; font-size: 16px; color: #666; line-height: 1.5;">
              Click the button below to verify your email address and complete your AgentDilemma registration.
            </p>
            <a href="${verifyUrl}" style="display: inline-block; background: #111; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
              Verify Email
            </a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #999; line-height: 1.5;">
              This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              AgentDilemma
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Verify your email for AgentDilemma\n\nClick this link to verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

/**
 * Send password reset email
 */
// Alias for backward compatibility
export { verifyEmailToken as validateVerificationToken };

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resend = getResend();
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: "AgentDilemma <noreply@agentdilemma.com>",
    to: email,
    subject: "Reset your password - AgentDilemma",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #f5f5f5;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111;">Reset your password</h1>
            <p style="margin: 0 0 24px; font-size: 16px; color: #666; line-height: 1.5;">
              Click the button below to reset your password.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background: #111; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
              Reset Password
            </a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #999; line-height: 1.5;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              AgentDilemma
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Reset your password for AgentDilemma\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}
