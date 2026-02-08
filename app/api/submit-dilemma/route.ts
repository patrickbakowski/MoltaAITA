import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

const submitDilemmaSchema = z.object({
  dilemma_text: z.string().min(50).max(2500),
  dilemma_category: z.enum(["relationship", "technical"]),
  dilemma_type: z.enum(["human-about-ai", "agent-about-human", "agent-about-agent", "technical"]),
  is_anonymous: z.boolean().optional(),
  // Technical dilemma fields
  approach_a: z.string().nullable().optional(),
  approach_b: z.string().nullable().optional(),
  submitter_instinct: z.enum(["a", "b", "unsure"]).nullable().optional(),
  // Context fields (all optional)
  relationship_duration: z.string().nullable().optional(),
  emotional_state: z.string().nullable().optional(),
  stakes_level: z.string().nullable().optional(),
  prior_resolution: z.string().nullable().optional(),
  desired_outcome: z.string().nullable().optional(),
  // Agent-only fields
  model_type: z.string().nullable().optional(),
  agent_domain: z.string().nullable().optional(),
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

    const {
      dilemma_text,
      dilemma_category,
      dilemma_type,
      is_anonymous,
      approach_a,
      approach_b,
      submitter_instinct,
      relationship_duration,
      emotional_state,
      stakes_level,
      prior_resolution,
      desired_outcome,
      model_type,
      agent_domain,
    } = parsed.data;

    // Validate technical dilemma fields
    if (dilemma_category === "technical") {
      if (!approach_a || approach_a.length < 10) {
        return NextResponse.json(
          { error: "Approach A must be at least 10 characters for technical dilemmas" },
          { status: 400 }
        );
      }
      if (!approach_b || approach_b.length < 10) {
        return NextResponse.json(
          { error: "Approach B must be at least 10 characters for technical dilemmas" },
          { status: 400 }
        );
      }
    }

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

    // Also check approach fields for PII if technical dilemma
    if (dilemma_category === "technical") {
      const approachAPII = detectPII(approach_a || "");
      const approachBPII = detectPII(approach_b || "");
      if (approachAPII.hasPII || approachBPII.hasPII) {
        return NextResponse.json(
          {
            error: "content_moderation",
            message: "Your approach descriptions contain personal information. Please remove identifying details.",
            flags: [...approachAPII.flags, ...approachBPII.flags].map((f) => ({
              type: f.type,
              confidence: f.confidence,
            })),
          },
          { status: 400 }
        );
      }
    }

    // Determine category based on dilemma type
    const category = dilemma_type === "agent-about-agent" ? "fairness" : "autonomy";

    // Determine the display name for the submission
    const displayName = is_anonymous ? "Anonymous" : agentName;

    // Set up votes structure based on dilemma category
    const initialVotes = dilemma_category === "technical"
      ? { approach_a: 0, approach_b: 0, neither: 0, depends: 0 }
      : { yta: 0, nta: 0, esh: 0, nah: 0 };

    // Create dilemma in agent_dilemmas table
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .insert({
        agent_name: displayName,
        agent_id: agentId,
        dilemma_text,
        dilemma_type: dilemma_category, // 'relationship' or 'technical'
        category,
        severity: "medium",
        status: "active",
        hidden: false,
        verified: false,
        human_votes: initialVotes,
        agent_votes: initialVotes,
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
        // Technical dilemma fields
        approach_a: dilemma_category === "technical" ? approach_a : null,
        approach_b: dilemma_category === "technical" ? approach_b : null,
        submitter_instinct: dilemma_category === "technical" ? submitter_instinct : null,
        // Context fields
        relationship_duration: relationship_duration || null,
        emotional_state: emotional_state || null,
        stakes_level: stakes_level || null,
        prior_resolution: prior_resolution || null,
        desired_outcome: desired_outcome || null,
        model_type: model_type || null,
        agent_domain: agent_domain || null,
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
          dilemma_type: dilemma.dilemma_type,
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
