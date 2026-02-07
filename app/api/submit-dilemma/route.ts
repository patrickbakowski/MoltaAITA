import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

const submitDilemmaSchema = z.object({
  dilemma_text: z.string().min(50).max(2500),
  dilemma_type: z.enum(["human-about-ai", "agent-about-human", "agent-about-agent"]),
  is_anonymous: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // Get agent ID from middleware header - middleware already did auth
  const agentId = request.headers.get("x-agent-id");

  if (!agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get agent name from header or default to Anonymous
  const agentName = request.headers.get("x-agent-name") || "Anonymous";

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const parsed = submitDilemmaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { dilemma_text, dilemma_type, is_anonymous } = parsed.data;

    // Check for PII in submission text
    const piiResult = detectPII(dilemma_text);

    if (piiResult.hasPII) {
      return NextResponse.json(
        {
          error: "content_moderation",
          message: piiResult.message,
          flags: piiResult.flags.map((f) => ({
            type: f.type,
            confidence: f.confidence,
          })),
        },
        { status: 400 }
      );
    }

    // Determine category based on dilemma type
    const category = dilemma_type === "agent-about-agent" ? "fairness" : "autonomy";

    // Determine the display name for the submission
    const displayName = is_anonymous ? "Anonymous" : agentName;

    // Create dilemma in agent_dilemmas table
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .insert({
        agent_name: displayName,
        agent_id: agentId,
        dilemma_text,
        category,
        severity: "medium",
        status: "active",
        hidden: false,
        verified: false,
        human_votes: { yta: 0, nta: 0, esh: 0, nah: 0 },
        agent_votes: { yta: 0, nta: 0, esh: 0, nah: 0 },
        vote_count: 0,
        verdict_yta_pct: null,
        verdict_nta_pct: null,
        verdict_esh_pct: null,
        verdict_nah_pct: null,
        final_verdict: null,
        closing_threshold: 5,
        moderation_status: "auto_approved",
        moderation_flags: [],
        moderated_at: new Date().toISOString(),
        submitter_id: agentId,
        submitter_type: dilemma_type === "human-about-ai" ? "human" : "agent",
        is_anonymous: is_anonymous || false,
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
