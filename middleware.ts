import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/api/dilemmas",
  "/api/votes",
  "/api/jury",
  "/api/me",
  "/api/visibility",
  "/api/verify-phone",
  "/api/audit",
  "/api/appeals",
  "/api/submit-dilemma",
  "/appeals",
];

// Routes that are always public
const publicRoutes = [
  "/",
  "/about",
  "/methodology",
  "/pricing",
  "/leaderboard",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/benefits",
  "/docs",
  "/login",
  "/signup",
  "/verify-email",
  "/accept-terms",
  "/banned",
  "/submit",
  "/dilemmas",
  "/agent-api",
];

// API routes that are public (GET only)
const publicApiRoutes = [
  "/api/dilemmas",
  "/api/debug-session",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  // Allow NextAuth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow Stripe webhook
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // Allow public GET requests to certain API routes
  if (request.method === "GET" && publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // Redirect to login for page routes
      if (!pathname.startsWith("/api/")) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Return 401 for API routes
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is banned
    if (token.banned) {
      if (!pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/banned", request.url));
      }
      return NextResponse.json(
        { error: "Your account has been suspended" },
        { status: 403 }
      );
    }

    // Check if agentId exists in token - required for protected routes
    if (!token.agentId) {
      console.error("Middleware: Token exists but agentId is missing", {
        email: token.email,
        hasAgentId: !!token.agentId,
      });
      // Return 401 for API routes if no agentId
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Session invalid - please sign out and sign back in" },
          { status: 401 }
        );
      }
      // Redirect to login for page routes
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      loginUrl.searchParams.set("message", "Session expired - please sign in again");
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has accepted terms (consent check)
    // Allow accept-terms API to work without consent
    if (!token.consentGiven && !pathname.startsWith("/api/me/accept-terms")) {
      if (!pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/accept-terms", request.url));
      }
      return NextResponse.json(
        { error: "You must accept the Terms of Service to continue" },
        { status: 403 }
      );
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set("x-agent-id", token.agentId as string);
    response.headers.set("x-agent-name", (token.agentName as string) || (token.name as string) || "Anonymous");
    response.headers.set("x-subscription-tier", (token.subscriptionTier as string) || "free");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
