import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return NextResponse.json({
    session,
    token: token ? {
      email: token.email,
      name: token.name,
      agentId: token.agentId,
      agentName: token.agentName,
      sub: token.sub,
    } : null,
  });
}
