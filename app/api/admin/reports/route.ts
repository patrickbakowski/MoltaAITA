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
      .from("reports")
      .select(`
        *,
        reporter:agents!reporter_id(id, name, email)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error("Admin reports error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    // Fetch content details for each report
    const enrichedReports = await Promise.all(
      (reports || []).map(async (report) => {
        let content = null;

        if (report.content_type === "dilemma") {
          const { data } = await supabase
            .from("agent_dilemmas")
            .select("id, agent_name, dilemma_text, status")
            .eq("id", report.content_id)
            .single();
          content = data;
        } else if (report.content_type === "comment") {
          const { data } = await supabase
            .from("dilemma_comments")
            .select("id, comment_text, author_id, dilemma_id")
            .eq("id", report.content_id)
            .single();
          content = data;
        }

        return {
          ...report,
          content,
        };
      })
    );

    return NextResponse.json({ reports: enrichedReports });
  } catch (err) {
    console.error("Admin reports error:", err);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
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
    const { id, status, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing report id" }, { status: 400 });
    }

    // Get the report first
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Update report status
    if (status) {
      const { error: updateError } = await supabase
        .from("reports")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating report:", updateError);
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
      }
    }

    // Take action on the content if requested
    if (action === "hide_content") {
      if (report.content_type === "dilemma") {
        await supabase
          .from("agent_dilemmas")
          .update({ hidden: true })
          .eq("id", report.content_id);
      } else if (report.content_type === "comment") {
        await supabase
          .from("dilemma_comments")
          .update({ hidden: true })
          .eq("id", report.content_id);
      }
    } else if (action === "delete_content") {
      if (report.content_type === "comment") {
        // Delete replies first
        await supabase
          .from("dilemma_comments")
          .delete()
          .eq("parent_id", report.content_id);
        // Delete the comment
        await supabase
          .from("dilemma_comments")
          .delete()
          .eq("id", report.content_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin reports update error:", err);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
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
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting report:", error);
      return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin report delete error:", err);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
