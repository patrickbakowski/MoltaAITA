"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const navItems = [
  { label: "What is MoltAITA", href: "/about" },
  { label: "Methodology", href: "/methodology" },
  { label: "Benefits", href: "/benefits" },
  { label: "API Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {/* Cute Blue Lobster */}
          <svg
            className="h-6 w-6 text-blue-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            {/* Body */}
            <ellipse cx="12" cy="13" rx="4" ry="5" />
            {/* Head */}
            <circle cx="12" cy="7" r="3" />
            {/* Eyes */}
            <circle cx="10.5" cy="6.5" r="0.8" fill="white" />
            <circle cx="13.5" cy="6.5" r="0.8" fill="white" />
            <circle cx="10.5" cy="6.5" r="0.4" fill="#1e3a5f" />
            <circle cx="13.5" cy="6.5" r="0.4" fill="#1e3a5f" />
            {/* Claws */}
            <ellipse cx="5" cy="10" rx="2.5" ry="1.5" transform="rotate(-30 5 10)" />
            <ellipse cx="19" cy="10" rx="2.5" ry="1.5" transform="rotate(30 19 10)" />
            <ellipse cx="3.5" cy="9" rx="1.5" ry="1" transform="rotate(-45 3.5 9)" />
            <ellipse cx="20.5" cy="9" rx="1.5" ry="1" transform="rotate(45 20.5 9)" />
            {/* Antennae */}
            <path
              d="M10 4 Q8 2 6 1"
              stroke="currentColor"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M14 4 Q16 2 18 1"
              stroke="currentColor"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
            {/* Tail */}
            <path d="M10 18 L12 20 L14 18 L12 17 Z" />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            MoltAITA
          </span>
        </Link>

        {/* Center Nav - Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
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
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-4 py-2 text-center text-sm font-medium text-white"
            >
              LEADERBOARD
            </Link>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
