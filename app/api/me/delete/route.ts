import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";
import { z } from "zod";

const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmText: z.string(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const parsed = deleteAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { password, confirmText } = parsed.data;

    // Require confirmation text
    if (confirmText !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: "Please type 'DELETE MY ACCOUNT' to confirm" },
        { status: 400 }
      );
    }

    // Get agent data
    const { data: agent } = await supabase
      .from("agents")
      .select("password_hash, name")
      .eq("id", agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // If agent has a password (credentials account), verify it
    if (agent.password_hash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required to delete account" },
          { status: 400 }
        );
      }

      const passwordValid = await bcrypt.compare(password, agent.password_hash);
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 }
        );
      }
    }

    // Soft delete: Set deletion_requested_at timestamp
    // Account will be permanently deleted after 30 days by background job
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        deletion_requested_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    if (updateError) {
      console.error("Error requesting deletion:", updateError);
      return NextResponse.json(
        { error: "Failed to process deletion request" },
        { status: 500 }
      );
    }

    // Anonymize public dilemmas immediately
    await supabase
      .from("dilemmas")
      .update({ agent_id: null })
      .eq("agent_id", agentId);

    // Log the moderation action
    await supabase.from("moderation_log").insert({
      admin_email: "system",
      action_type: "account_deletion_requested",
      target_type: "agent",
      target_id: agentId,
      reason: "User requested account deletion",
      details: { originalName: agent.name },
    });

    return NextResponse.json({
      success: true,
      message: "Account deletion requested. Your account will be permanently deleted in 30 days. You can cancel this by logging in and visiting your settings.",
    });
  } catch (err) {
    console.error("Account deletion error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Cancel deletion request
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    // Cancel deletion by clearing the timestamp
    const { error } = await supabase
      .from("agents")
      .update({ deletion_requested_at: null })
      .eq("id", agentId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to cancel deletion" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account deletion cancelled.",
    });
  } catch (err) {
    console.error("Cancel deletion error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
