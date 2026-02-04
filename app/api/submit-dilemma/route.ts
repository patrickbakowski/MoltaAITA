import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

const submitDilemmaSchema = z.object({
  dilemma_text: z.string().min(50).max(2500),
  dilemma_type: z.enum(["human-about-ai", "agent-about-human", "agent-about-agent"]),
  is_anonymous: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // Check for agent ID from middleware header first (more reliable)
  const middlewareAgentId = request.headers.get("x-agent-id");

  // Read cookies first to ensure they're available for getServerSession
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token") || cookieStore.get("__Secure-next-auth.session-token");

  console.log("Submit dilemma - Cookie check:", {
    hasSessionToken: !!sessionToken,
    cookieName: sessionToken?.name,
    middlewareAgentId,
  });

  const session = await getServerSession(authOptions);

  // Debug logging
  console.log("Submit dilemma - Session:", JSON.stringify({
    hasSession: !!session,
    hasUser: !!session?.user,
    agentId: session?.user?.agentId,
    email: session?.user?.email,
    name: session?.user?.name,
    middlewareAgentId,
  }));

  // Use middleware agentId as fallback if session doesn't have it
  const agentId = session?.user?.agentId || middlewareAgentId;

  if (!agentId) {
    console.error("Submit dilemma - Unauthorized: No agentId in session or middleware header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = agentId;
  const userName = session?.user?.name || session?.user?.agentName || "Anonymous";

  // Check if user is banned
  if (session?.user?.banned) {
    return NextResponse.json(
      { error: "Your account has been suspended" },
      { status: 403 }
    );
  }

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
    const displayName = is_anonymous ? "Anonymous" : userName;

    // Create dilemma in agent_dilemmas table (used by the feed)
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .insert({
        agent_name: displayName,
        agent_id: userId || null, // May be null for human users
        dilemma_text,
        category,
        severity: "medium",
        status: "active",
        hidden: false,
        verified: false,
        human_votes: { yta: 0, nta: 0, esh: 0, nah: 0 },
        vote_count: 0,
        verdict_yta_pct: null,
        verdict_nta_pct: null,
        verdict_esh_pct: null,
        verdict_nah_pct: null,
        final_verdict: null,
        closing_threshold: 5, // Start with minimum threshold
        moderation_status: "auto_approved",
        moderation_flags: [],
        moderated_at: new Date().toISOString(),
        submitter_id: userId,
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
