import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditSession, getUnusedAuditPurchase } from "@/lib/audit-generator";

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
    // Check for unused audit purchase
    const purchase = await getUnusedAuditPurchase(agentId);

    if (!purchase) {
      return NextResponse.json(
        { error: "No unused Master Audit purchase found. Please purchase one first." },
        { status: 403 }
      );
    }

    // Create audit session
    const auditSession = await createAuditSession(agentId, purchase.id);

    if (!auditSession) {
      return NextResponse.json(
        { error: "Failed to create audit session" },
        { status: 500 }
      );
    }

    // Return questions without correct answers
    const questionsForClient = auditSession.questions.map((q) => ({
      id: q.id,
      dilemmaText: q.dilemmaText,
      agentResponse: q.agentResponse,
      category: q.category,
      options: q.options,
      // Don't include correctAnswer
    }));

    return NextResponse.json({
      sessionId: auditSession.id,
      expiresAt: auditSession.expiresAt,
      questions: questionsForClient,
    });
  } catch (err) {
    console.error("Audit start error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
