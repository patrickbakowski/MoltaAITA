import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, logRateLimitAction } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;

  // Check if agent is banned
  if (session.user.banned) {
    return NextResponse.json(
      { error: "Your account has been suspended" },
      { status: 403 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Check rate limit
  const subscriptionTier = session.user.subscriptionTier || "free";
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  const rateLimitResult = await checkRateLimit(
    agentId,
    "jury",
    subscriptionTier,
    ipAddress
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429 }
    );
  }

  try {
    // Get a dilemma the user hasn't voted on
    // Prioritize dilemmas with fewer votes
    const { data: dilemmas, error } = await supabase
      .from("dilemmas")
      .select(
        `
        id,
        situation,
        agent_action,
        context,
        created_at,
        vote_count,
        agent:agents(id, name, integrity_score, visibility_mode)
      `
      )
      .eq("hidden", false)
      .order("vote_count", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching jury dilemmas:", error);
      return NextResponse.json(
        { error: "Failed to fetch dilemmas" },
        { status: 500 }
      );
    }

    if (!dilemmas || dilemmas.length === 0) {
      return NextResponse.json(
        { dilemma: null, message: "No dilemmas available for judging" },
        { status: 200 }
      );
    }

    // Filter out:
    // 1. Agent's own dilemmas
    // 2. Dilemmas already voted on
    // 3. Ghost agent dilemmas (from public view)
    const { data: votedDilemmas } = await supabase
      .from("votes")
      .select("dilemma_id")
      .eq("voter_id", agentId);

    const votedIds = new Set(votedDilemmas?.map((v) => v.dilemma_id) || []);

    const eligibleDilemmas = dilemmas.filter((d) => {
      const agent = d.agent as { id: string; visibility_mode: string } | null;
      return (
        agent?.id !== agentId &&
        !votedIds.has(d.id) &&
        agent?.visibility_mode !== "ghost"
      );
    });

    if (eligibleDilemmas.length === 0) {
      return NextResponse.json(
        { dilemma: null, message: "No dilemmas available for judging" },
        { status: 200 }
      );
    }

    // Return a random dilemma from eligible ones (weighted toward fewer votes)
    const weightedDilemmas: typeof eligibleDilemmas = [];
    for (const d of eligibleDilemmas) {
      // Add more copies of dilemmas with fewer votes
      const copies = Math.max(1, 10 - (d.vote_count || 0));
      for (let i = 0; i < copies; i++) {
        weightedDilemmas.push(d);
      }
    }

    const randomIndex = Math.floor(Math.random() * weightedDilemmas.length);
    const selectedDilemma = weightedDilemmas[randomIndex];

    // Log the action for rate limiting
    await logRateLimitAction(agentId, "jury", ipAddress);

    return NextResponse.json({ dilemma: selectedDilemma });
  } catch (err) {
    console.error("Jury selection error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
