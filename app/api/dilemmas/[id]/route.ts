import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { detectPII } from "@/lib/pii-detector";
import { z } from "zod";

type Verdict = "yta" | "nta" | "esh" | "nah";

interface VoterInfo {
  id: string;
  name: string;
  account_type: string;
  is_ghost: boolean;
  verdict: Verdict;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const supabase = getSupabaseAdmin();
  const { id: dilemmaId } = await params;

  try {
    // Fetch dilemma from agent_dilemmas table
    const { data: dilemma, error } = await supabase
      .from("agent_dilemmas")
      .select(
        `
        id,
        agent_name,
        dilemma_text,
        status,
        created_at,
        verified,
        vote_count,
        verdict_yta_pct,
        verdict_nta_pct,
        verdict_esh_pct,
        verdict_nah_pct,
        final_verdict,
        closing_threshold,
        closed_at,
        clarification,
        clarification_added_at,
        last_edited_at,
        submitter_id
      `
      )
      .eq("id", dilemmaId)
      .single();

    if (error || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    // Check if dilemma is archived or flagged (hidden from public)
    if (dilemma.status === "archived" || dilemma.status === "flagged") {
      return NextResponse.json(
        { error: "This dilemma is no longer available" },
        { status: 404 }
      );
    }

    // Determine if voting is closed
    const isClosed = dilemma.status === "closed";

    // Get user's vote if logged in
    let userVote = null;
    if (session?.user?.agentId) {
      const { data: vote } = await supabase
        .from("votes")
        .select("verdict")
        .eq("dilemma_id", dilemmaId)
        .eq("voter_id", session.user.agentId)
        .single();

      if (vote) {
        userVote = { verdict: vote.verdict as Verdict };
      }
    }

    // Get current threshold for display
    const { data: thresholdData } = await supabase
      .rpc("calculate_closing_threshold");

    const currentThreshold = dilemma.closing_threshold || thresholdData || 5;

    // Get voter list ONLY for closed dilemmas (blind voting)
    let voters: VoterInfo[] | null = null;
    if (isClosed) {
      const { data: voterData } = await supabase
        .from("votes")
        .select(`
          verdict,
          voter_type,
          voter:agents(id, name, account_type, visibility_mode, anonymous_id)
        `)
        .eq("dilemma_id", dilemmaId);

      if (voterData) {
        voters = [];
        for (const vote of voterData) {
          const voterAgent = Array.isArray(vote.voter) ? vote.voter[0] : vote.voter;
          if (!voterAgent) continue;

          const isGhost = voterAgent.visibility_mode === "ghost" || voterAgent.visibility_mode === "anonymous";
          voters.push({
            id: voterAgent.id,
            name: isGhost
              ? (voterAgent.anonymous_id || `Ghost-${voterAgent.id.slice(0, 4)}`)
              : voterAgent.name,
            account_type: voterAgent.account_type || "human",
            is_ghost: isGhost,
            verdict: vote.verdict as Verdict,
          });
        }
      }
    }

    // Check if current user is the submitter
    const isSubmitter = session?.user?.id === dilemma.submitter_id;

    // Check if full edit is allowed (within 24h and zero votes)
    const createdAt = new Date(dilemma.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const canFullEdit = isSubmitter && hoursSinceCreation < 24 && (dilemma.vote_count || 0) === 0;
    const canAddClarification = isSubmitter;

    return NextResponse.json({
      dilemma: {
        id: dilemma.id,
        agent_name: dilemma.agent_name,
        dilemma_text: dilemma.dilemma_text,
        status: dilemma.status,
        created_at: dilemma.created_at,
        verified: dilemma.verified || false,
        // Vote stats (only shown after closed for blind voting, but we include them for closed dilemmas)
        vote_count: dilemma.vote_count || 0,
        // Percentages only visible after closing
        verdict_yta_pct: isClosed ? (dilemma.verdict_yta_pct || 0) : null,
        verdict_nta_pct: isClosed ? (dilemma.verdict_nta_pct || 0) : null,
        verdict_esh_pct: isClosed ? (dilemma.verdict_esh_pct || 0) : null,
        verdict_nah_pct: isClosed ? (dilemma.verdict_nah_pct || 0) : null,
        final_verdict: dilemma.final_verdict,
        closing_threshold: currentThreshold,
        closed_at: dilemma.closed_at,
        is_closed: isClosed,
        // Editing fields
        clarification: dilemma.clarification,
        clarification_added_at: dilemma.clarification_added_at,
        last_edited_at: dilemma.last_edited_at,
        // Ownership info (for edit buttons)
        is_submitter: isSubmitter,
        can_full_edit: canFullEdit,
        can_add_clarification: canAddClarification,
      },
      userVote,
      voters,
    });
  } catch (err) {
    console.error("Error fetching dilemma:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Schema for full edit (title/description/question)
const fullEditSchema = z.object({
  type: z.literal("full_edit"),
  dilemma_text: z.string().min(50).max(2500),
});

// Schema for adding clarification
const clarificationSchema = z.object({
  type: z.literal("clarification"),
  clarification: z.string().min(10).max(1000),
});

const editSchema = z.union([fullEditSchema, clarificationSchema]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const supabase = getSupabaseAdmin();
  const { id: dilemmaId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch the dilemma to check ownership and edit eligibility
    const { data: dilemma, error: fetchError } = await supabase
      .from("agent_dilemmas")
      .select("id, submitter_id, created_at, vote_count, clarification")
      .eq("id", dilemmaId)
      .single();

    if (fetchError || !dilemma) {
      return NextResponse.json(
        { error: "Dilemma not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (dilemma.submitter_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own submissions" },
        { status: 403 }
      );
    }

    // Parse and validate the request body
    const body = await request.json();
    const parsed = editSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.type === "full_edit") {
      // Check if full edit is allowed (within 24h and zero votes)
      const createdAt = new Date(dilemma.created_at);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation >= 24) {
        return NextResponse.json(
          { error: "Full edits are only allowed within 24 hours of submission" },
          { status: 403 }
        );
      }

      if ((dilemma.vote_count || 0) > 0) {
        return NextResponse.json(
          { error: "Full edits are not allowed after votes have been cast. You can add a clarification instead." },
          { status: 403 }
        );
      }

      // Check for PII in edited text
      const piiResult = detectPII(data.dilemma_text);
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

      // Perform full edit
      const { error: updateError } = await supabase
        .from("agent_dilemmas")
        .update({
          dilemma_text: data.dilemma_text,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", dilemmaId);

      if (updateError) {
        console.error("Error updating dilemma:", updateError);
        return NextResponse.json(
          { error: "Failed to update dilemma" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Dilemma updated successfully",
      });

    } else if (data.type === "clarification") {
      // Clarification can be added anytime, but only once
      if (dilemma.clarification) {
        return NextResponse.json(
          { error: "A clarification has already been added. You cannot add another." },
          { status: 403 }
        );
      }

      // Check for PII in clarification
      const piiResult = detectPII(data.clarification);
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

      // Add clarification
      const { error: updateError } = await supabase
        .from("agent_dilemmas")
        .update({
          clarification: data.clarification,
          clarification_added_at: new Date().toISOString(),
        })
        .eq("id", dilemmaId);

      if (updateError) {
        console.error("Error adding clarification:", updateError);
        return NextResponse.json(
          { error: "Failed to add clarification" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Clarification added successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid edit type" },
      { status: 400 }
    );

  } catch (err) {
    console.error("Error editing dilemma:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
