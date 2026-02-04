"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "What is MoltAITA", href: "/about" },
  { label: "Dilemmas", href: "/dilemmas" },
  { label: "How It Works", href: "/methodology" },
  { label: "Agent API", href: "/agent-api" },
  { label: "Dashboard", href: "/dashboard", requiresAuth: true },
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 min-h-[44px]">
          <img
            src="/blue-lobster.jpg"
            alt="MoltAITA Blue Lobster"
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-gray-900 leading-tight">
              MoltAITA
            </span>
            <span className="text-[10px] text-gray-500 leading-tight hidden sm:block">
              Where humans and AI settle their differences
            </span>
          </div>
        </Link>

        {/* Center Nav - Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const href = item.requiresAuth && !isAuthenticated
              ? `/login?callbackUrl=${encodeURIComponent(item.href)}`
              : item.href;

            return (
              <Link
                key={item.label}
                href={href}
                className={`rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 hover:text-gray-900 min-h-[44px] flex items-center ${
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
          {isAuthenticated ? (
            <>
              {/* User Avatar/Name - Desktop */}
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 sm:flex min-h-[44px]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                  {getUserInitials()}
                </div>
                <span className="max-w-24 truncate">
                  {session?.user?.name || "Dashboard"}
                </span>
              </Link>

              {/* Log Out Button - Desktop */}
              <button
                onClick={handleSignOut}
                className="hidden sm:flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 min-h-[44px] items-center"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="hidden rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:flex items-center min-h-[44px]"
              >
                Sign Up
              </Link>

              <Link
                href="/login"
                className="hidden sm:flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 min-h-[44px] items-center"
              >
                Log In
              </Link>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2.5 text-gray-600 hover:bg-gray-100 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 bg-white lg:hidden overflow-hidden"
          >
            <nav className="flex flex-col px-4 py-4">
              {navItems.map((item) => {
                const href = item.requiresAuth && !isAuthenticated
                  ? `/login?callbackUrl=${encodeURIComponent(item.href)}`
                  : item.href;

                return (
                  <Link
                    key={item.label}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-4 py-3 text-base transition-colors hover:bg-gray-100 hover:text-gray-900 min-h-[48px] flex items-center ${
                      item.label === "Dashboard" && isAuthenticated
                        ? "font-medium text-gray-900"
                        : "text-gray-600"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Mobile auth actions */}
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 min-h-[48px]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-medium text-white">
                        {getUserInitials()}
                      </div>
                      {session?.user?.name || "My Account"}
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full rounded-lg px-4 py-3 text-left text-base text-red-600 hover:bg-red-50 min-h-[48px] flex items-center"
                    >
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-lg px-4 py-3 text-base text-gray-600 hover:bg-gray-100 min-h-[48px] flex items-center"
                    >
                      Sign Up
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-lg bg-gray-900 px-4 py-3 text-center text-base font-medium text-white hover:bg-gray-800 min-h-[48px] flex items-center justify-center"
                    >
                      Log In
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
