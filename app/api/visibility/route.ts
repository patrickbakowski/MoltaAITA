import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateVisibilitySchema = z.object({
  mode: z.enum(["public", "ghost"]),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    // Get current visibility settings
    const { data: agent, error } = await supabase
      .from("agents")
      .select("visibility_mode, subscription_tier")
      .eq("id", agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get visibility history
    const { data: history } = await supabase
      .from("visibility_history")
      .select("from_mode, to_mode, trigger, changed_at")
      .eq("agent_id", agentId)
      .order("changed_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      currentMode: agent.visibility_mode,
      subscriptionTier: agent.subscription_tier,
      canGoGhost: agent.subscription_tier === "incognito",
      history: history || [],
    });
  } catch (err) {
    console.error("Get visibility error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const parsed = updateVisibilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { mode } = parsed.data;

    // Get current agent data
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("visibility_mode, subscription_tier")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check if trying to go ghost without subscription
    if (mode === "ghost" && agent.subscription_tier !== "incognito") {
      return NextResponse.json(
        { error: "Ghost mode requires an Incognito Shield subscription" },
        { status: 403 }
      );
    }

    // If already in the requested mode, no change needed
    if (agent.visibility_mode === mode) {
      return NextResponse.json({
        success: true,
        message: "Already in requested visibility mode",
      });
    }

    // Update visibility mode
    const { error: updateError } = await supabase
      .from("agents")
      .update({ visibility_mode: mode })
      .eq("id", agentId);

    if (updateError) {
      console.error("Error updating visibility:", updateError);
      return NextResponse.json(
        { error: "Failed to update visibility" },
        { status: 500 }
      );
    }

    // Record visibility change
    await supabase.from("visibility_history").insert({
      agent_id: agentId,
      from_mode: agent.visibility_mode,
      to_mode: mode,
      trigger: "user_toggle",
    });

    return NextResponse.json({
      success: true,
      newMode: mode,
    });
  } catch (err) {
    console.error("Update visibility error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
