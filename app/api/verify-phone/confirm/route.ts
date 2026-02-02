import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmPhoneVerification } from "@/lib/phone";
import { z } from "zod";

const confirmVerificationSchema = z.object({
  verificationSid: z.string(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;

  try {
    const body = await request.json();
    const parsed = confirmVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    const { verificationSid, code } = parsed.data;

    const result = await confirmPhoneVerification(agentId, verificationSid, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (err) {
    console.error("Phone verification confirm error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
