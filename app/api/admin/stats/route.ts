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

  try {
    // Get counts in parallel
    const [
      { count: totalHumans },
      { count: totalAgents },
      { count: totalDilemmas },
      { count: totalVotes },
      { count: pendingVerdicts },
      { count: openAppeals },
      { count: pendingCorrections },
      { count: pendingExports },
    ] = await Promise.all([
      supabase.from("agents").select("*", { count: "exact", head: true }).eq("account_type", "human"),
      supabase.from("agents").select("*", { count: "exact", head: true }).eq("account_type", "agent"),
      supabase.from("agent_dilemmas").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("agent_dilemmas").select("*", { count: "exact", head: true }).eq("status", "active").is("final_verdict", null),
      supabase.from("appeals").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("data_correction_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("data_export_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    return NextResponse.json({
      totalHumans: totalHumans || 0,
      totalAgents: totalAgents || 0,
      totalDilemmas: totalDilemmas || 0,
      totalVotes: totalVotes || 0,
      pendingVerdicts: pendingVerdicts || 0,
      openAppeals: openAppeals || 0,
      pendingDataRequests: (pendingCorrections || 0) + (pendingExports || 0),
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
