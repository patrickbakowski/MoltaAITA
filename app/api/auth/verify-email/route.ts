import { NextRequest, NextResponse } from "next/server";
import { validateVerificationToken } from "@/lib/email";
import { z } from "zod";

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    const result = await validateVerificationToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your email has been verified successfully!",
    });
  } catch (err) {
    console.error("Email verification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
