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

    // Get dilemma stats from agent_dilemmas table (where submissions go)
    const { count: totalDilemmas } = await supabase
      .from("agent_dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("submitter_id", agentId);

    const { count: visibleDilemmas } = await supabase
      .from("agent_dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("submitter_id", agentId)
      .eq("hidden", false);

    const { count: hiddenDilemmas } = await supabase
      .from("agent_dilemmas")
      .select("*", { count: "exact", head: true })
      .eq("submitter_id", agentId)
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
        anonymousByDefault: agent.anonymous_by_default ?? false,
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
    const { name, anonymousByDefault } = body;

    const updates: Record<string, unknown> = {};

    // Handle name update
    if (name !== undefined) {
      if (typeof name === "string" && name.length >= 2 && name.length <= 50) {
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
        updates.name = name;
      } else {
        return NextResponse.json(
          { error: "Name must be between 2 and 50 characters" },
          { status: 400 }
        );
      }
    }

    // Handle anonymousByDefault update
    if (anonymousByDefault !== undefined) {
      if (typeof anonymousByDefault === "boolean") {
        updates.anonymous_by_default = anonymousByDefault;
      } else {
        return NextResponse.json(
          { error: "anonymousByDefault must be a boolean" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid update data provided" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", agentId);

    if (error) {
      console.error("Error updating agent:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update me error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
