import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startPhoneVerification, hasVerifiedPhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const startVerificationSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.agentId;
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  // Check if already verified
  if (await hasVerifiedPhone(agentId)) {
    return NextResponse.json(
      { error: "Phone number already verified" },
      { status: 400 }
    );
  }

  // Rate limit phone verification attempts
  const subscriptionTier = session.user.subscriptionTier || "free";
  const rateLimitResult = await checkRateLimit(
    agentId,
    "phone_verification",
    subscriptionTier,
    ipAddress
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many verification attempts",
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = startVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      );
    }

    const { phoneNumber } = parsed.data;

    const result = await startPhoneVerification(agentId, phoneNumber, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verificationSid: result.verificationSid,
      message: "Verification code sent",
    });
  } catch (err) {
    console.error("Phone verification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
