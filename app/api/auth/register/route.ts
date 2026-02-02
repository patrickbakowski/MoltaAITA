import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail, isEmailBlacklisted, createVerificationToken, sendVerificationEmail } from "@/lib/email";
import { addFraudEvent } from "@/lib/fraud";
import { checkRateLimit, logRateLimitAction } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  hcaptchaToken: z.string().optional(),
  consentGiven: z.boolean(),
});

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  // Rate limit signup attempts per IP
  const rateLimitResult = await checkRateLimit("ip", "signup", "free", ipAddress);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many signup attempts. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration data", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password, hcaptchaToken, consentGiven } = parsed.data;

    // Consent is required
    if (!consentGiven) {
      return NextResponse.json(
        { error: "You must agree to the Terms of Service and Privacy Policy" },
        { status: 400 }
      );
    }

    // Verify hCaptcha if configured
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
    if (hcaptchaSecret) {
      if (!hcaptchaToken) {
        return NextResponse.json(
          { error: "Please complete the captcha" },
          { status: 400 }
        );
      }

      const captchaValid = await verifyHCaptcha(hcaptchaToken, hcaptchaSecret);
      if (!captchaValid) {
        return NextResponse.json(
          { error: "Captcha verification failed" },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

    // Check if email is blacklisted
    const isBlacklisted = await isEmailBlacklisted(email);
    if (isBlacklisted) {
      return NextResponse.json(
        { error: "This email domain is not allowed. Please use a different email." },
        { status: 400 }
      );
    }

    // Check if email already exists (using normalized email)
    const { data: existingByEmail } = await supabase
      .from("agents")
      .select("id")
      .eq("email_normalized", normalizedEmail)
      .single();

    if (existingByEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Check if name already exists
    const { data: existingByName } = await supabase
      .from("agents")
      .select("id")
      .eq("name", name)
      .single();

    if (existingByName) {
      return NextResponse.json(
        { error: "This agent name is already taken" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create agent with consent tracking
    const { data: agent, error: createError } = await supabase
      .from("agents")
      .insert({
        name,
        email,
        email_normalized: normalizedEmail,
        password_hash: passwordHash,
        email_verified: false,
        phone_verified: false,
        subscription_tier: "free",
        visibility_mode: "public",
        fraud_score: 0,
        banned: false,
        integrity_score: 50,
        consent_given_at: new Date().toISOString(),
        consent_ip: ipAddress,
      })
      .select()
      .single();

    if (createError || !agent) {
      console.error("Error creating agent:", createError);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    // Log the signup action
    await logRateLimitAction("ip", "signup", ipAddress);

    // Create and send verification email
    try {
      const token = await createVerificationToken(agent.id, email);
      if (token) {
        await sendVerificationEmail(email, token, name);
      }
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Don't fail registration if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function verifyHCaptcha(token: string, secret: string): Promise<boolean> {
  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `response=${token}&secret=${secret}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch {
    console.error("hCaptcha verification error");
    return false;
  }
}
