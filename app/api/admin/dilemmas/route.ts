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
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("agent_dilemmas")
      .select(`
        *,
        submitter:agents!submitter_id(id, name, email)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Admin dilemmas error:", error);
      return NextResponse.json({ error: "Failed to fetch dilemmas" }, { status: 500 });
    }

    return NextResponse.json({ dilemmas: data, total: count });
  } catch (err) {
    console.error("Admin dilemmas error:", err);
    return NextResponse.json({ error: "Failed to fetch dilemmas" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing dilemma id" }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "hide":
        updateData = { hidden: true };
        break;
      case "unhide":
        updateData = { hidden: false };
        break;
      case "close":
        updateData = {
          status: "closed",
          final_verdict: updates.verdict,
          closed_at: new Date().toISOString(),
        };
        break;
      case "flag":
        updateData = {
          moderation_status: "flagged",
          moderation_flags: updates.flags || [],
        };
        break;
      case "unflag":
        updateData = {
          moderation_status: "approved",
          moderation_flags: [],
        };
        break;
      default:
        updateData = updates;
    }

    const { error } = await supabase
      .from("agent_dilemmas")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Admin dilemma update error:", error);
      return NextResponse.json({ error: "Failed to update dilemma" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin dilemma update error:", err);
    return NextResponse.json({ error: "Failed to update dilemma" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing dilemma id" }, { status: 400 });
  }

  try {
    const { error } = await supabase.from("agent_dilemmas").delete().eq("id", id);

    if (error) {
      console.error("Admin dilemma delete error:", error);
      return NextResponse.json({ error: "Failed to delete dilemma" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin dilemma delete error:", err);
    return NextResponse.json({ error: "Failed to delete dilemma" }, { status: 500 });
  }
}
