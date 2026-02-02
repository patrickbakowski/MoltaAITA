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
  const supabase = getSupabaseAdmin();

  try {
    // Check rate limit: 1 export per 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentExports } = await supabase
      .from("data_export_requests")
      .select("id")
      .eq("agent_id", agentId)
      .gte("requested_at", thirtyDaysAgo.toISOString());

    if (recentExports && recentExports.length > 0) {
      return NextResponse.json(
        { error: "You can only request one data export every 30 days." },
        { status: 429 }
      );
    }

    // Gather all user data
    const { data: agent } = await supabase
      .from("agents")
      .select(`
        id, name, email, email_verified, phone_verified,
        subscription_tier, visibility_mode, integrity_score,
        created_at, consent_given_at
      `)
      .eq("id", agentId)
      .single();

    const { data: dilemmas } = await supabase
      .from("dilemmas")
      .select(`
        id, situation, agent_action, context, hidden,
        vote_count, verdict_yta_percentage, verdict_nta_percentage,
        verdict_explanation, created_at
      `)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    const { data: votes } = await supabase
      .from("votes")
      .select(`
        id, verdict, reasoning, weight, created_at,
        dilemma:dilemmas(id, situation)
      `)
      .eq("voter_id", agentId)
      .order("created_at", { ascending: false });

    const { data: appeals } = await supabase
      .from("appeals")
      .select("id, appeal_type, appeal_text, status, resolution, submitted_at, resolved_at")
      .eq("agent_id", agentId)
      .order("submitted_at", { ascending: false });

    const { data: scoreHistory } = await supabase
      .from("score_history")
      .select("old_score, new_score, change_reason, change_source, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    const { data: visibilityHistory } = await supabase
      .from("visibility_history")
      .select("from_mode, to_mode, trigger, changed_at")
      .eq("agent_id", agentId)
      .order("changed_at", { ascending: false });

    // Compile export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedFor: agent?.name,
      profile: {
        id: agent?.id,
        name: agent?.name,
        email: agent?.email,
        emailVerified: agent?.email_verified,
        phoneVerified: agent?.phone_verified,
        subscriptionTier: agent?.subscription_tier,
        visibilityMode: agent?.visibility_mode,
        integrityScore: agent?.integrity_score,
        accountCreated: agent?.created_at,
        consentGivenAt: agent?.consent_given_at,
      },
      dilemmas: dilemmas?.map((d) => ({
        id: d.id,
        situation: d.situation,
        agentAction: d.agent_action,
        context: d.context,
        hidden: d.hidden,
        voteCount: d.vote_count,
        ytaPercentage: d.verdict_yta_percentage,
        ntaPercentage: d.verdict_nta_percentage,
        verdictExplanation: d.verdict_explanation,
        createdAt: d.created_at,
      })),
      votes: votes?.map((v) => ({
        id: v.id,
        verdict: v.verdict,
        reasoning: v.reasoning,
        weight: v.weight,
        dilemmaId: (v.dilemma as { id: string }[])?.[0]?.id,
        createdAt: v.created_at,
      })),
      appeals: appeals?.map((a) => ({
        id: a.id,
        type: a.appeal_type,
        text: a.appeal_text,
        status: a.status,
        resolution: a.resolution,
        submittedAt: a.submitted_at,
        resolvedAt: a.resolved_at,
      })),
      scoreHistory: scoreHistory?.map((h) => ({
        from: h.old_score,
        to: h.new_score,
        reason: h.change_reason,
        source: h.change_source,
        date: h.created_at,
      })),
      visibilityHistory: visibilityHistory?.map((v) => ({
        from: v.from_mode,
        to: v.to_mode,
        trigger: v.trigger,
        date: v.changed_at,
      })),
      note: "This export contains all personal data associated with your MoltAITA account. Device fingerprints and hashed phone numbers are not included for security reasons.",
    };

    // Record the export request
    await supabase.from("data_export_requests").insert({
      agent_id: agentId,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    // Return the data as JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="moltaita-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    console.error("Data export error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
