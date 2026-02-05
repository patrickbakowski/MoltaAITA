import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    let query = supabase
      .from("appeals")
      .select(`
        id,
        agent_id,
        appeal_type,
        appeal_text,
        status,
        resolution,
        submitted_at,
        resolved_at,
        agent:agents!agent_id(id, name, email, account_type, banned)
      `)
      .order("submitted_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: appeals, error } = await query;

    if (error) {
      console.error("Admin appeals fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch appeals" }, { status: 500 });
    }

    // Transform the joined data
    const transformedAppeals = (appeals || []).map((a: Record<string, unknown>) => ({
      ...a,
      agent: Array.isArray(a.agent) ? a.agent[0] : a.agent,
    }));

    return NextResponse.json({ appeals: transformedAppeals });
  } catch (err) {
    console.error("Admin appeals error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { id, action, resolution } = await request.json();

    if (!id || !action) {
      return NextResponse.json({ error: "ID and action required" }, { status: 400 });
    }

    // Get the appeal first
    const { data: appeal } = await supabase
      .from("appeals")
      .select("agent_id, appeal_type")
      .eq("id", id)
      .single();

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Update appeal status
      await supabase
        .from("appeals")
        .update({
          status: "approved",
          resolution: resolution || "Appeal approved by admin",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      // If it's a ban appeal, unban the user
      if (appeal.appeal_type === "ban") {
        await supabase
          .from("agents")
          .update({
            banned: false,
            ban_reason: null,
            banned_at: null,
          })
          .eq("id", appeal.agent_id);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "reject") {
      await supabase
        .from("appeals")
        .update({
          status: "rejected",
          resolution: resolution || "Appeal rejected by admin",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Admin appeal action error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Appeal ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("appeals")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete appeal error:", error);
      return NextResponse.json({ error: "Failed to delete appeal" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin appeal delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
