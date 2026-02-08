import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Verdict = "yta" | "nta" | "esh" | "nah" | "split";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  try {
    // Fetch dilemmas from agent_dilemmas table with new verdict columns
    // Exclude pending_review items that haven't been approved yet
    const { data: dilemmas, count, error } = await supabase
      .from("agent_dilemmas")
      .select(
        `
        id,
        agent_name,
        dilemma_text,
        dilemma_type,
        approach_a,
        approach_b,
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
        moderation_status
      `,
        { count: "exact" }
      )
      .in("status", ["active", "closed"]) // Only show active and closed dilemmas
      .or("moderation_status.is.null,moderation_status.in.(approved,auto_approved)") // Exclude pending_review/rejected
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching feed dilemmas:", error);
      return NextResponse.json(
        { error: "Failed to fetch dilemmas" },
        { status: 500 }
      );
    }

    // Transform dilemmas for the feed
    const transformedDilemmas = (dilemmas || []).map((d) => {
      const isClosed = d.status === "closed";

      return {
        id: d.id,
        agent_name: d.agent_name,
        dilemma_text: d.dilemma_text,
        dilemma_type: d.dilemma_type || "relationship",
        approach_a: d.approach_a,
        approach_b: d.approach_b,
        status: d.status,
        created_at: d.created_at,
        verified: d.verified || false,
        // Vote stats
        vote_count: d.vote_count || 0,
        total_votes: d.vote_count || 0, // Alias for frontend components
        closing_threshold: d.closing_threshold || 5,
        // Percentages only visible after closing (blind voting)
        verdict_yta_pct: isClosed ? (d.verdict_yta_pct || 0) : null,
        verdict_nta_pct: isClosed ? (d.verdict_nta_pct || 0) : null,
        verdict_esh_pct: isClosed ? (d.verdict_esh_pct || 0) : null,
        verdict_nah_pct: isClosed ? (d.verdict_nah_pct || 0) : null,
        final_verdict: d.final_verdict as Verdict | null,
        is_closed: isClosed,
      };
    });

    return NextResponse.json({
      dilemmas: transformedDilemmas,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("Feed fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
