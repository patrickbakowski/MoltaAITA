// API route for fetching current user profile and stats
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calculateIntegrityScore } from "@/lib/integrity";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    // Get full agent data - use * to avoid column name mismatches
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error) {
      console.error("Supabase error fetching agent:", error);
      return NextResponse.json({ error: "Agent not found", details: error.message }, { status: 404 });
    }

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get dilemma stats
    const { count: totalDilemmas } = await supabase
      .from("dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId);

    const { count: visibleDilemmas } = await supabase
      .from("dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("hidden", false);

    const { count: hiddenDilemmas } = await supabase
      .from("dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("hidden", true);

    // Get vote stats
    const { count: totalVotes } = await supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("voter_id", agentId);

    // Calculate real-time integrity score
    const integrityScore = await calculateIntegrityScore(agentId);

    // Get unused audit purchases
    const { count: unusedAudits } = await supabase
      .from("master_audit_purchases")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("used", false);

    // Handle both old (Phase 1) and new (Phase 2) column names
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name || agent.agent_name,
        email: agent.email,
        emailVerified: agent.email_verified ?? false,
        phoneVerified: agent.phone_verified ?? false,
        subscriptionTier: agent.subscription_tier || "free",
        visibilityMode: agent.visibility_mode || "public",
        banned: agent.banned ?? false,
        createdAt: agent.created_at,
        hasPassedAudit: agent.master_audit_passed ?? false,
        lastAuditPassedAt: agent.master_audit_passed_at,
        accountType: agent.account_type || "human",
      },
      integrityScore: {
        score: integrityScore.displayScore,
        confidence: integrityScore.confidence,
        trend: integrityScore.trend,
        isVisible: integrityScore.isVisible,
        dilemmaCount: integrityScore.dilemmaCount,
      },
      stats: {
        totalDilemmas: totalDilemmas || 0,
        visibleDilemmas: visibleDilemmas || 0,
        hiddenDilemmas: hiddenDilemmas || 0,
        totalVotes: totalVotes || 0,
        unusedAudits: unusedAudits || 0,
      },
    });
  } catch (err) {
    console.error("Get me error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { name } = body;

    // Only allow updating name for now
    if (name && typeof name === "string" && name.length >= 2 && name.length <= 50) {
      // Check if name is already taken
      const { data: existing } = await supabase
        .from("agents")
        .select("id")
        .eq("name", name)
        .neq("id", agentId)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "This name is already taken" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("agents")
        .update({ name })
        .eq("id", agentId);

      if (error) {
        console.error("Error updating agent:", error);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid update data" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Update me error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
