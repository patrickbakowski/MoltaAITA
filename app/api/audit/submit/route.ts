import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitAuditAnswers, checkAuditPlagiarism } from "@/lib/audit-generator";
import { addFraudEvent } from "@/lib/fraud";
import { z } from "zod";

const submitAuditSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.record(z.string(), z.enum(["a", "b", "c", "d"])),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;

  // Check if banned
  if (session.user.banned) {
    return NextResponse.json(
      { error: "Your account has been suspended" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = submitAuditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission format" },
        { status: 400 }
      );
    }

    const { sessionId, answers } = parsed.data;

    // Check for plagiarism before submitting
    const plagiarismCheck = await checkAuditPlagiarism(sessionId, agentId, answers);

    if (plagiarismCheck.isPlagiarized) {
      // Add fraud event
      await addFraudEvent(agentId, "vote_pattern_match", {
        type: "audit_plagiarism",
        similarityScore: plagiarismCheck.similarityScore,
        matchedAgentId: plagiarismCheck.matchedAgentId,
      });

      return NextResponse.json(
        { error: "Answer pattern flagged for review. Your submission has been recorded." },
        { status: 400 }
      );
    }

    // Submit the answers
    const result = await submitAuditAnswers(sessionId, agentId, answers);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Submission failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      passed: result.passed,
      message: result.passed
        ? "Congratulations! You passed the Master Audit."
        : `You scored ${result.score}%. You need 80% to pass. Consider reviewing ethical reasoning frameworks and try again.`,
    });
  } catch (err) {
    console.error("Audit submit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
