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
  const type = searchParams.get("type"); // "export" or "correction"
  const status = searchParams.get("status");

  try {
    // Fetch export requests
    let exportQuery = supabase
      .from("data_export_requests")
      .select(`
        id,
        agent_id,
        status,
        requested_at,
        completed_at,
        agent:agents!agent_id(id, name, email)
      `)
      .order("requested_at", { ascending: false });

    if (status) {
      exportQuery = exportQuery.eq("status", status);
    }

    // Fetch correction requests
    let correctionQuery = supabase
      .from("data_correction_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      correctionQuery = correctionQuery.eq("status", status);
    }

    const [exportResult, correctionResult] = await Promise.all([
      type !== "correction" ? exportQuery : Promise.resolve({ data: [], error: null }),
      type !== "export" ? correctionQuery : Promise.resolve({ data: [], error: null }),
    ]);

    if (exportResult.error) {
      console.error("Export requests fetch error:", exportResult.error);
    }
    if (correctionResult.error) {
      console.error("Correction requests fetch error:", correctionResult.error);
    }

    // Transform export requests
    const exports = (exportResult.data || []).map((e: Record<string, unknown>) => ({
      ...e,
      request_type: "export" as const,
      agent: Array.isArray(e.agent) ? e.agent[0] : e.agent,
    }));

    // Transform correction requests
    const corrections = (correctionResult.data || []).map((c: Record<string, unknown>) => ({
      ...c,
      request_type: "correction" as const,
    }));

    // Combine and sort by date
    const allRequests = [...exports, ...corrections];
    const sortedAll = allRequests.sort((a, b) => {
      const dateA = (a as Record<string, unknown>).requested_at || (a as Record<string, unknown>).created_at;
      const dateB = (b as Record<string, unknown>).requested_at || (b as Record<string, unknown>).created_at;
      return new Date(dateB as string).getTime() - new Date(dateA as string).getTime();
    });

    return NextResponse.json({
      exports,
      corrections,
      all: sortedAll,
    });
  } catch (err) {
    console.error("Admin GDPR error:", err);
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
    const { id, type, action } = await request.json();

    if (!id || !type || !action) {
      return NextResponse.json({ error: "ID, type, and action required" }, { status: 400 });
    }

    if (type === "export") {
      if (action === "complete") {
        await supabase
          .from("data_export_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", id);
      } else if (action === "reject") {
        await supabase
          .from("data_export_requests")
          .update({ status: "rejected" })
          .eq("id", id);
      }
    } else if (type === "correction") {
      if (action === "complete") {
        await supabase
          .from("data_correction_requests")
          .update({ status: "completed" })
          .eq("id", id);
      } else if (action === "reject") {
        await supabase
          .from("data_correction_requests")
          .update({ status: "rejected" })
          .eq("id", id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin GDPR action error:", err);
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
    const { id, type } = await request.json();

    if (!id || !type) {
      return NextResponse.json({ error: "ID and type required" }, { status: 400 });
    }

    if (type === "export") {
      await supabase.from("data_export_requests").delete().eq("id", id);
    } else if (type === "correction") {
      await supabase.from("data_correction_requests").delete().eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin GDPR delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
