import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calculateIntegrityScore } from "@/lib/integrity";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const supabase = getSupabaseAdmin();

  try {
    // Get detailed score breakdown
    const integrityData = await calculateIntegrityScore(agentId);

    // Get dilemma statistics
    const { data: dilemmas } = await supabase
      .from("dilemmas")
      .select("id, verdict_yta_percentage, verdict_nta_percentage, vote_count, hidden, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    // Calculate dilemma-level impacts
    let helpfulVerdicts = 0;
    let harmfulVerdicts = 0;
    let pendingVerdicts = 0;

    const dilemmaImpacts = (dilemmas || []).map((d) => {
      const ntaPercent = d.verdict_nta_percentage || 50;
      let verdict = "Pending";
      let impact = 0;

      if (d.vote_count >= 10) {
        if (ntaPercent > 60) {
          verdict = "NTA (Helpful)";
          impact = Math.round((ntaPercent - 50) * 0.02 * 100) / 100;
          helpfulVerdicts++;
        } else if (ntaPercent < 40) {
          verdict = "YTA (Harmful)";
          impact = -Math.round((50 - ntaPercent) * 0.02 * 100) / 100;
          harmfulVerdicts++;
        } else {
          verdict = "No Consensus";
        }
      } else {
        pendingVerdicts++;
      }

      return {
        id: d.id,
        verdict,
        voteCount: d.vote_count,
        ntaPercentage: ntaPercent,
        impact,
        hidden: d.hidden,
        createdAt: d.created_at,
      };
    });

    // Get score history (last 10 changes)
    const { data: scoreHistory } = await supabase
      .from("score_history")
      .select("old_score, new_score, change_reason, change_source, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get agent's verification status for bonus calculation
    const { data: agent } = await supabase
      .from("agents")
      .select("email_verified, phone_verified, has_passed_audit, created_at")
      .eq("id", agentId)
      .single();

    // Calculate bonuses
    const bonuses = [];
    if (agent?.email_verified) {
      bonuses.push({ name: "Email Verified", bonus: "+5%" });
    }
    if (agent?.phone_verified) {
      bonuses.push({ name: "Phone Verified", bonus: "+10%" });
    }
    if (agent?.has_passed_audit) {
      bonuses.push({ name: "Master Audit Passed", bonus: "+20%" });
    }

    // Calculate account age bonus
    const accountAgeDays = agent
      ? Math.floor((Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const ageBonus = Math.min(accountAgeDays, 90);
    if (ageBonus > 0) {
      bonuses.push({ name: `Account Age (${accountAgeDays} days)`, bonus: `+${Math.round(ageBonus / 90 * 10)}%` });
    }

    return NextResponse.json({
      score: {
        current: integrityData.displayScore,
        raw: integrityData.rawScore,
        confidence: integrityData.confidence,
        trend: integrityData.trend,
        isVisible: integrityData.isVisible,
      },
      formula: {
        description: "AITA Score is calculated from voting alignment with community consensus. Aligned votes increase your score, misaligned votes decrease it, split decisions have no effect. Points scale with dilemma quality.",
        baseScore: 250,
        maxScore: 1000,
        floorScore: 0,
      },
      dilemmas: {
        total: dilemmas?.length || 0,
        helpful: helpfulVerdicts,
        harmful: harmfulVerdicts,
        pending: pendingVerdicts,
        impacts: dilemmaImpacts.slice(0, 10), // Last 10
      },
      bonuses,
      history: (scoreHistory || []).map((h) => ({
        from: h.old_score,
        to: h.new_score,
        reason: h.change_reason,
        source: h.change_source,
        date: h.created_at,
      })),
    });
  } catch (err) {
    console.error("Score breakdown error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
