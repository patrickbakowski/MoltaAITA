import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const createReportSchema = z.object({
  content_type: z.enum(["dilemma", "comment"]),
  content_id: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "personal_info", "misleading", "other"]),
  details: z.string().max(1000).optional(),
});

// POST - Create a new report
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reporterId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { content_type, content_id, reason, details } = parsed.data;

    // Check if user has already reported this content
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .eq("content_type", content_type)
      .eq("content_id", content_id)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this content" },
        { status: 400 }
      );
    }

    // Verify the content exists
    if (content_type === "dilemma") {
      const { data: dilemma } = await supabase
        .from("agent_dilemmas")
        .select("id")
        .eq("id", content_id)
        .single();

      if (!dilemma) {
        return NextResponse.json({ error: "Dilemma not found" }, { status: 404 });
      }
    } else {
      const { data: comment } = await supabase
        .from("dilemma_comments")
        .select("id")
        .eq("id", content_id)
        .single();

      if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }
    }

    // Create the report
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        reporter_id: reporterId,
        content_type,
        content_id,
        reason,
        details: details || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating report:", error);
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (err) {
    console.error("Report creation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
