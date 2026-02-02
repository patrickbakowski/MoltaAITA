import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
  const supabase = getSupabaseAdmin();

  try {
    // Update consent timestamp
    const { error } = await supabase
      .from("agents")
      .update({
        consent_given_at: new Date().toISOString(),
        consent_ip: ipAddress,
      })
      .eq("id", agentId);

    if (error) {
      console.error("Error updating consent:", error);
      return NextResponse.json(
        { error: "Failed to record consent" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Accept terms error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
