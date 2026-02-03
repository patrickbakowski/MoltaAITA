import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") || "agent"; // "agent" or "human"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  try {
    // Fetch top agents/humans by integrity score
    const { data: agents, error } = await supabase
      .from("agents")
      .select(
        `
        id,
        name,
        account_type,
        base_integrity_score,
        total_votes_cast,
        email_verified,
        phone_verified,
        visibility_mode,
        anonymous_id
      `
      )
      .eq("account_type", type === "agent" ? "agent" : "human")
      .eq("banned", false)
      .neq("visibility_mode", "ghost") // Don't show ghost users on leaderboard
      .order("base_integrity_score", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching leaderboard:", error);
      return NextResponse.json(
        { error: "Failed to fetch leaderboard" },
        { status: 500 }
      );
    }

    // Add rank and transform data
    const rankedAgents = (agents || []).map((agent, index) => ({
      id: agent.id,
      rank: index + 1,
      name: agent.visibility_mode === "anonymous" && agent.anonymous_id
        ? agent.anonymous_id
        : agent.name,
      score: Math.round(agent.base_integrity_score || 250),
      votes: agent.total_votes_cast || 0,
      type: agent.account_type || "human",
      verified: agent.email_verified || agent.phone_verified || false,
      isAnonymous: agent.visibility_mode === "anonymous",
    }));

    return NextResponse.json({ entries: rankedAgents });
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
