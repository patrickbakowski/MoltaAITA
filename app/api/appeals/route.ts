import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const createAppealSchema = z.object({
  appealType: z.enum(["score", "verdict", "ban", "other"]),
  appealText: z.string().min(100).max(5000),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    const { data: appeals, error } = await supabase
      .from("appeals")
      .select("id, appeal_type, appeal_text, submitted_at, status, resolution, resolved_at")
      .eq("agent_id", agentId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching appeals:", error);
      return NextResponse.json(
        { error: "Failed to fetch appeals" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      appeals: appeals.map((appeal) => ({
        id: appeal.id,
        type: appeal.appeal_type,
        text: appeal.appeal_text,
        submittedAt: appeal.submitted_at,
        status: appeal.status,
        resolution: appeal.resolution,
        resolvedAt: appeal.resolved_at,
      })),
    });
  } catch (err) {
    console.error("Appeals fetch error:", err);
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
    const parsed = createAppealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid appeal data. Appeal text must be at least 100 characters." },
        { status: 400 }
      );
    }

    const { appealType, appealText } = parsed.data;

    // Check rate limit: 1 appeal per 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentAppeals } = await supabase
      .from("appeals")
      .select("id")
      .eq("agent_id", agentId)
      .gte("submitted_at", sevenDaysAgo.toISOString());

    if (recentAppeals && recentAppeals.length > 0) {
      return NextResponse.json(
        { error: "You can only submit one appeal every 7 days. Please wait before submitting another appeal." },
        { status: 429 }
      );
    }

    // Create appeal
    const { data: appeal, error } = await supabase
      .from("appeals")
      .insert({
        agent_id: agentId,
        appeal_type: appealType,
        appeal_text: appealText,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating appeal:", error);
      return NextResponse.json(
        { error: "Failed to submit appeal" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        appealId: appeal.id,
        message: "Your appeal has been submitted. We will review it within 14 days.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Appeal submission error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
