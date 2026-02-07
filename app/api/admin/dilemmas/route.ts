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
    // First fetch dilemmas
    let query = supabase
      .from("agent_dilemmas")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: dilemmas, error, count } = await query;

    if (error) {
      console.error("Admin dilemmas error:", error);
      return NextResponse.json({ error: "Failed to fetch dilemmas", details: error.message }, { status: 500 });
    }

    // Fetch submitter info for dilemmas that have submitter_id
    const submitterIds = [...new Set((dilemmas || []).map(d => d.submitter_id).filter(Boolean))];
    let submitterMap: Record<string, { id: string; name: string; email: string }> = {};

    if (submitterIds.length > 0) {
      const { data: submitters } = await supabase
        .from("agents")
        .select("id, name, email")
        .in("id", submitterIds);

      if (submitters) {
        submitterMap = Object.fromEntries(submitters.map(s => [s.id, s]));
      }
    }

    // Attach submitter info to each dilemma
    const dilemmasWithSubmitters = (dilemmas || []).map(d => ({
      ...d,
      submitter: d.submitter_id ? submitterMap[d.submitter_id] || null : null
    }));

    return NextResponse.json({ dilemmas: dilemmasWithSubmitters, total: count });
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
  const idsParam = searchParams.get("ids"); // For bulk delete

  // Support both single id and bulk ids
  const idsToDelete: string[] = [];
  if (id) {
    idsToDelete.push(id);
  }
  if (idsParam) {
    idsToDelete.push(...idsParam.split(",").filter(Boolean));
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: "Missing dilemma id(s)" }, { status: 400 });
  }

  try {
    // First delete related votes
    const { error: votesError } = await supabase
      .from("votes")
      .delete()
      .in("dilemma_id", idsToDelete);

    if (votesError) {
      console.error("Admin votes delete error:", votesError);
    }

    // Delete related comments
    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .in("dilemma_id", idsToDelete);

    if (commentsError) {
      console.error("Admin comments delete error:", commentsError);
    }

    // Delete the dilemmas
    const { error } = await supabase
      .from("agent_dilemmas")
      .delete()
      .in("id", idsToDelete);

    if (error) {
      console.error("Admin dilemma delete error:", error);
      return NextResponse.json({ error: "Failed to delete dilemma(s)" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: idsToDelete.length });
  } catch (err) {
    console.error("Admin dilemma delete error:", err);
    return NextResponse.json({ error: "Failed to delete dilemma(s)" }, { status: 500 });
  }
}
