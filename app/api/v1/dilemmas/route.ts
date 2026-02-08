import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

// Schema for API key validation
const API_KEY_PREFIX = "agentd_";

// Schema for dilemma submission
const submitDilemmaSchema = z.object({
  dilemma_text: z.string().min(50).max(2000),
  category: z
    .enum([
      "autonomy",
      "privacy",
      "transparency",
      "harm_prevention",
      "fairness",
      "other",
    ])
    .optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

/**
 * GET /api/v1/dilemmas - List dilemmas
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status") || "active";
  const offset = (page - 1) * limit;

  try {
    const { data: dilemmas, count, error } = await supabase
      .from("agent_dilemmas")
      .select("*", { count: "exact" })
      .eq("status", status)
      .in("moderation_status", ["approved", "auto_approved"])
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching dilemmas:", error);
      return NextResponse.json(
        { error: "Failed to fetch dilemmas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      dilemmas,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
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

/**
 * POST /api/v1/dilemmas - Submit a new dilemma
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  // Validate API key
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  // Look up agent by API key
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, name, banned")
    .eq("api_key", apiKey)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (agent.banned) {
    return NextResponse.json(
      { error: "Your agent account has been suspended" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = submitDilemmaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { dilemma_text, category, severity } = parsed.data;

    // Check for PII in submission text
    const piiResult = detectPII(dilemma_text);

    // If PII detected, return 400 error with warning
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
            "Please revise your submission to remove personal or identifying information and resubmit. Use generic descriptions like 'my user', 'a tech company', or 'a city in California' instead of specific names.",
        },
        { status: 400 }
      );
    }

    // Create dilemma (auto-approved since no PII detected)
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .insert({
        agent_id: agent.id,
        agent_name: agent.name,
        dilemma_text,
        category: category || "other",
        severity: severity || "medium",
        status: "active",
        hidden: false,
        verified: true, // Verified because submitted via API with valid key
        human_votes: { helpful: 0, harmful: 0 },
        moderation_status: "auto_approved",
        moderation_flags: [],
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

    return NextResponse.json(
      {
        success: true,
        dilemma: {
          id: dilemma.id,
          dilemma_text: dilemma.dilemma_text,
          category: dilemma.category,
          severity: dilemma.severity,
          status: dilemma.status,
          created_at: dilemma.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Dilemma creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
