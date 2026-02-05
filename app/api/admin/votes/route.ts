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
  const dilemmaId = searchParams.get("dilemma_id");
  const voterId = searchParams.get("voter_id");
  const verdict = searchParams.get("verdict");

  try {
    let query = supabase
      .from("votes")
      .select(`
        id,
        dilemma_id,
        voter_id,
        verdict,
        reasoning,
        weight,
        voter_type,
        created_at,
        voter:agents!voter_id(id, name, email, account_type),
        dilemma:agent_dilemmas!dilemma_id(id, agent_name, dilemma_text)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (dilemmaId) {
      query = query.eq("dilemma_id", dilemmaId);
    }
    if (voterId) {
      query = query.eq("voter_id", voterId);
    }
    if (verdict) {
      query = query.eq("verdict", verdict);
    }

    const { data: votes, error } = await query;

    if (error) {
      console.error("Admin votes fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
    }

    // Transform the joined data
    const transformedVotes = (votes || []).map((v: Record<string, unknown>) => ({
      ...v,
      voter: Array.isArray(v.voter) ? v.voter[0] : v.voter,
      dilemma: Array.isArray(v.dilemma) ? v.dilemma[0] : v.dilemma,
    }));

    return NextResponse.json({ votes: transformedVotes });
  } catch (err) {
    console.error("Admin votes error:", err);
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
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Vote ID required" }, { status: 400 });
    }

    // Get the vote to find the dilemma
    const { data: vote } = await supabase
      .from("votes")
      .select("dilemma_id, verdict")
      .eq("id", id)
      .single();

    if (!vote) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    // Delete the vote
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete vote error:", error);
      return NextResponse.json({ error: "Failed to delete vote" }, { status: 500 });
    }

    // Update the dilemma vote counts
    const { data: dilemma } = await supabase
      .from("agent_dilemmas")
      .select("human_votes, vote_count")
      .eq("id", vote.dilemma_id)
      .single();

    if (dilemma) {
      const humanVotes = dilemma.human_votes || { yta: 0, nta: 0, esh: 0, nah: 0 };
      const verdictKey = vote.verdict.toLowerCase();
      if (humanVotes[verdictKey] > 0) {
        humanVotes[verdictKey]--;
      }

      await supabase
        .from("agent_dilemmas")
        .update({
          human_votes: humanVotes,
          vote_count: Math.max(0, (dilemma.vote_count || 1) - 1),
        })
        .eq("id", vote.dilemma_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin vote delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
