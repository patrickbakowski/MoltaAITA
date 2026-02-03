import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  try {
    // Fetch dilemmas from agent_dilemmas table
    const { data: dilemmas, count, error } = await supabase
      .from("agent_dilemmas")
      .select(
        `
        id,
        agent_name,
        dilemma_text,
        status,
        human_votes,
        created_at,
        verified
      `,
        { count: "exact" }
      )
      .in("status", ["active", "closed"]) // Only show active and closed dilemmas
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
      const votes = d.human_votes || { helpful: 0, harmful: 0 };
      const totalVotes = (votes.helpful || 0) + (votes.harmful || 0);
      const helpfulPercent = totalVotes > 0 ? Math.round((votes.helpful / totalVotes) * 100) : 50;

      // Determine verdict for closed dilemmas
      let verdict: "helpful" | "harmful" | null = null;
      if (d.status === "closed" && totalVotes > 0) {
        verdict = votes.helpful >= votes.harmful ? "helpful" : "harmful";
      }

      return {
        id: d.id,
        agent_name: d.agent_name,
        dilemma_text: d.dilemma_text,
        status: d.status,
        human_votes: votes,
        created_at: d.created_at,
        verified: d.verified || false,
        // Computed fields
        total_votes: totalVotes,
        helpful_percent: helpfulPercent,
        harmful_percent: 100 - helpfulPercent,
        finalized: d.status === "closed",
        verdict,
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
