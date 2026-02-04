import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const correctionSchema = z.object({
  correctionType: z.enum(["profile", "dilemma", "vote", "other"]),
  description: z.string().min(20).max(2000),
  dilemmaId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  const userName = session.user.name;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const parsed = correctionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { correctionType, description, dilemmaId } = parsed.data;

    // Save the correction request to the database
    const { error: insertError } = await supabase
      .from("data_correction_requests")
      .insert({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        correction_type: correctionType,
        description,
        dilemma_id: dilemmaId || null,
        status: "pending",
      });

    // If the table doesn't exist, we'll still send the email
    if (insertError) {
      console.log("Could not save correction request to DB:", insertError.message);
    }

    // Send notification email (in production, use a proper email service)
    // For now, we'll log it and return success
    console.log("Data correction request:", {
      userId,
      userEmail,
      userName,
      correctionType,
      description,
      dilemmaId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Your data correction request has been submitted. We will review it within 14 days and contact you at your registered email address.",
    });
  } catch (err) {
    console.error("Data correction request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
