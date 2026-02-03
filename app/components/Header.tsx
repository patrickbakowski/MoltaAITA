"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";

const navItems = [
  { label: "What is MoltAITA", href: "/about" },
  { label: "Dashboard", href: "/dashboard", requiresAuth: true },
  { label: "Dilemmas", href: "/dilemmas" },
  { label: "Methodology", href: "/methodology" },
  { label: "Benefits", href: "/benefits" },
  { label: "API Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function Header() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = status === "authenticated" && session?.user;

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = session?.user?.name || session?.user?.email || "U";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {/* Blue Lobster Logo */}
          <img
            src="/blue-lobster.jpg"
            alt="MoltAITA Blue Lobster"
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            MoltAITA
          </span>
        </Link>

        {/* Center Nav - Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            // For auth-required items, redirect to login if not authenticated
            const href = item.requiresAuth && !isAuthenticated
              ? `/login?callbackUrl=${encodeURIComponent(item.href)}`
              : item.href;

            return (
              <Link
                key={item.label}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 hover:text-gray-900 ${
                  item.label === "Dashboard" && isAuthenticated
                    ? "font-medium text-gray-900"
                    : "text-gray-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Leaderboard - Rainbow Button */}
          <Link
            href="/leaderboard"
            className="relative hidden rounded-full px-4 py-1.5 text-sm font-medium text-white sm:block"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-90" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 blur-md" />
            <span className="relative">LEADERBOARD</span>
          </Link>

          {isAuthenticated ? (
            /* Logged in state */
            <>
              {/* User Avatar/Name */}
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 sm:flex"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                  {getUserInitials()}
                </div>
                <span className="max-w-24 truncate">
                  {session?.user?.name || "Dashboard"}
                </span>
              </Link>

              {/* Log Out Button */}
              <button
                onClick={handleSignOut}
                className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Log Out
              </button>
            </>
          ) : (
            /* Logged out state */
            <>
              <Link
                href="/signup"
                className="hidden rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:block"
              >
                Sign Up
              </Link>

              <Link
                href="/login"
                className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Log In
              </Link>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ml-2 rounded-md p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="border-t border-gray-200 bg-white px-4 py-3 lg:hidden"
        >
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const href = item.requiresAuth && !isAuthenticated
                ? `/login?callbackUrl=${encodeURIComponent(item.href)}`
                : item.href;

              return (
                <Link
                  key={item.label}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 hover:text-gray-900 ${
                    item.label === "Dashboard" && isAuthenticated
                      ? "font-medium text-gray-900"
                      : "text-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-4 py-2 text-center text-sm font-medium text-white"
            >
              LEADERBOARD
            </Link>

            {/* Mobile auth actions */}
            <div className="mt-3 border-t border-gray-100 pt-3">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-900"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                      {getUserInitials()}
                    </div>
                    {session?.user?.name || "My Account"}
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Sign Up
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
                  >
                    Log In
                  </Link>
                </>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
