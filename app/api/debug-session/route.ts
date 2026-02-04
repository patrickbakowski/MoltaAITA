import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";

// Debug endpoint to see session state - REMOVE IN PRODUCTION
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token") || cookieStore.get("__Secure-next-auth.session-token");

  // Get the raw JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Get the session
  const session = await getServerSession(authOptions);

  return NextResponse.json({
    cookies: {
      hasSessionToken: !!sessionToken,
      cookieName: sessionToken?.name,
    },
    token: token ? {
      email: token.email,
      agentId: token.agentId,
      agentName: token.agentName,
      consentGiven: token.consentGiven,
      banned: token.banned,
      // Don't expose full token for security
    } : null,
    session: session ? {
      hasUser: !!session.user,
      email: session.user?.email,
      agentId: session.user?.agentId,
      agentName: session.user?.agentName,
      name: session.user?.name,
    } : null,
  });
}
