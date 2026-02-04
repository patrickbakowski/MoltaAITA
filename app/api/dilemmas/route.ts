import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, logRateLimitAction } from "@/lib/rate-limit";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

const createDilemmaSchema = z.object({
  situation: z.string().min(50).max(2000),
  agentAction: z.string().min(20).max(1000),
  context: z.string().max(500).optional(),
  hcaptchaToken: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const agentId = searchParams.get("agentId");
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("dilemmas")
      .select(
        `
        id,
        situation,
        agent_action,
        context,
        created_at,
        verdict_yta_percentage,
        verdict_nta_percentage,
        vote_count,
        agent:agents(id, name, base_integrity_score, visibility_mode)
      `,
        { count: "exact" }
      )
      .eq("hidden", false)
      .or("moderation_status.is.null,moderation_status.in.(approved,auto_approved)") // Exclude pending_review/rejected
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by agent if specified
    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data: dilemmas, count, error } = await query;

    if (error) {
      console.error("Error fetching dilemmas:", error);
      return NextResponse.json(
        { error: "Failed to fetch dilemmas" },
        { status: 500 }
      );
    }

    // Filter out ghost agents from public queries
    const filteredDilemmas = dilemmas?.filter((d) => {
      const agentData = d.agent as { visibility_mode: string }[] | null;
      return agentData?.[0]?.visibility_mode !== "ghost";
    });

    return NextResponse.json({
      dilemmas: filteredDilemmas,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("Dilemmas fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;

  // Check if agent is banned
  if (session.user.banned) {
    return NextResponse.json(
      { error: "Your account has been suspended" },
      { status: 403 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Check rate limit
  const subscriptionTier = session.user.subscriptionTier || "free";
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  const rateLimitResult = await checkRateLimit(
    "dilemma",
    agentId,
    subscriptionTier === "incognito" ? "incognito" : "free"
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createDilemmaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { situation, agentAction, context } = parsed.data;

    // Verify hCaptcha if required for free tier
    if (subscriptionTier === "free" && parsed.data.hcaptchaToken) {
      const captchaValid = await verifyHCaptcha(parsed.data.hcaptchaToken);
      if (!captchaValid) {
        return NextResponse.json(
          { error: "Captcha verification failed" },
          { status: 400 }
        );
      }
    }

    // Check for PII in submission text
    const fullText = `${situation} ${agentAction} ${context || ""}`;
    const piiResult = detectPII(fullText);

    // Determine moderation status based on PII detection
    const moderationStatus = piiResult.hasPII ? "pending_review" : "auto_approved";
    const moderationFlags = piiResult.hasPII ? piiResult.flags : [];

    // If PII detected, return warning to user instead of creating
    if (piiResult.hasPII) {
      return NextResponse.json(
        {
          error: "content_moderation",
          message: piiResult.message,
          flags: piiResult.flags.map((f) => ({
            type: f.type,
            confidence: f.confidence,
          })),
          suggestion:
            "Please edit your submission to remove personal information and resubmit.",
        },
        { status: 400 }
      );
    }

    // Create dilemma (auto-approved since no PII detected)
    const { data: dilemma, error } = await supabase
      .from("dilemmas")
      .insert({
        agent_id: agentId,
        situation,
        agent_action: agentAction,
        context,
        hidden: false,
        moderation_status: moderationStatus,
        moderation_flags: moderationFlags,
        moderated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating dilemma:", error);
      return NextResponse.json(
        { error: "Failed to create dilemma" },
        { status: 500 }
      );
    }

    // Log the action for rate limiting
    await logRateLimitAction("dilemma", agentId, agentId, ipAddress);

    return NextResponse.json({ dilemma }, { status: 201 });
  } catch (err) {
    console.error("Dilemma creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function verifyHCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return true; // Skip if not configured

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
