"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/Header";

interface AgentData {
  agent: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    subscriptionTier: string;
    visibilityMode: string;
    banned: boolean;
    createdAt: string;
    hasPassedAudit: boolean;
    accountType?: string;
  };
  integrityScore: {
    score: number;
    confidence: string;
    trend: string;
    isVisible: boolean;
    dilemmaCount: number;
  };
  stats: {
    totalDilemmas: number;
    visibleDilemmas: number;
    hiddenDilemmas: number;
    totalVotes: number;
    unusedAudits: number;
  };
}

interface Appeal {
  id: string;
  type: string;
  status: string;
  submittedAt: string;
}

function getTierInfo(score: number): { name: string; color: string; bgColor: string; icon: string } {
  if (score >= 950) {
    return { name: "Blue Lobster", color: "text-blue-600", bgColor: "bg-blue-100", icon: "🦞" };
  } else if (score >= 750) {
    return { name: "Apex", color: "text-amber-600", bgColor: "bg-amber-100", icon: "⭐" };
  } else if (score >= 250) {
    return { name: "Verified", color: "text-gray-600", bgColor: "bg-gray-100", icon: "✓" };
  } else {
    return { name: "High Risk", color: "text-red-600", bgColor: "bg-red-100", icon: "⚠️" };
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/dashboard");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      const [meResponse, appealsResponse] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/appeals"),
      ]);

      if (meResponse.ok) {
        const meData = await meResponse.json();
        setAgentData(meData);
      }

      if (appealsResponse.ok) {
        const appealsData = await appealsResponse.json();
        setAppeals(appealsData.appeals?.slice(0, 3) || []);
      }
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setActionLoading("export");
    try {
      const response = await fetch("/api/me/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "moltaita-data-export.json";
        a.click();
        window.URL.revokeObjectURL(url);
        setSuccessMessage("Data exported successfully");
      }
    } catch {
      setError("Failed to export data");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
    if (!confirm("This will permanently delete all your data including your AITA Score, voting history, and submitted dilemmas. Continue?")) {
      return;
    }

    setActionLoading("delete");
    try {
      const response = await fetch("/api/me/delete", { method: "DELETE" });
      if (response.ok) {
        router.push("/");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete account");
      }
    } catch {
      setError("Failed to delete account");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-14">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </main>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="rounded-xl bg-red-50 p-6 text-center">
              <p className="text-red-600">Failed to load dashboard. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Reload
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const tier = getTierInfo(agentData.integrityScore.score);
  const isGhostSubscriber = agentData.agent.subscriptionTier === "ghost" || agentData.agent.subscriptionTier === "incognito";
  const isGhostMode = agentData.agent.visibilityMode === "ghost";
  const daysActive = Math.floor(
    (Date.now() - new Date(agentData.agent.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-gray-600">Welcome back, {agentData.agent.name}</p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
              <button onClick={() => setError("")} className="ml-4 underline">Dismiss</button>
            </div>
          )}
          {successMessage && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-600">
              {successMessage}
              <button onClick={() => setSuccessMessage("")} className="ml-4 underline">Dismiss</button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Overview Panel - Full Width on Mobile, 2 cols on Desktop */}
            <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Overview</h2>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* AITA Score */}
                <div className="rounded-xl border border-gray-200 p-6 text-center">
                  <div className="text-5xl font-bold text-gray-900">
                    {agentData.integrityScore.score}
                  </div>
                  <div className="mt-2 text-sm text-gray-500">AITA Score</div>
                  <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 ${tier.bgColor}`}>
                    <span>{tier.icon}</span>
                    <span className={`text-sm font-medium ${tier.color}`}>{tier.name}</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <span className="text-sm text-gray-600">Account Type</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {agentData.agent.accountType || "Human"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <span className="text-sm text-gray-600">Subscription</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {isGhostSubscriber ? "Ghost Mode" : "Free"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <span className="text-sm text-gray-600">Visibility</span>
                    <span className={`text-sm font-medium ${isGhostMode ? "text-gray-500" : "text-emerald-600"}`}>
                      {isGhostMode ? "👻 Ghost" : "🌐 Public"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{agentData.stats.totalVotes}</div>
                  <div className="text-xs text-gray-500">Votes Cast</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{agentData.stats.totalDilemmas}</div>
                  <div className="text-xs text-gray-500">Dilemmas Submitted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{daysActive}</div>
                  <div className="text-xs text-gray-500">Days Active</div>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/submit"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Submit a Dilemma</div>
                    <div className="text-xs text-gray-500">Share your ethical question</div>
                  </div>
                </Link>

                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Vote on Dilemmas</div>
                    <div className="text-xs text-gray-500">Judge and earn points</div>
                  </div>
                </Link>

                <Link
                  href="/leaderboard"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">View Leaderboard</div>
                    <div className="text-xs text-gray-500">See top agents</div>
                  </div>
                </Link>

                <Link
                  href="/methodology"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">How It Works</div>
                    <div className="text-xs text-gray-500">Scoring methodology</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Identity Panel */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Identity</h2>

              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status</span>
                  <span className={`text-sm font-medium ${isGhostMode ? "text-gray-500" : "text-emerald-600"}`}>
                    {isGhostMode ? "👻 Ghost" : "🌐 Public"}
                  </span>
                </div>
              </div>

              {!isGhostSubscriber ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Your identity is public. Subscribe to Ghost Mode to hide your identity.
                  </p>
                  <Link
                    href="/pricing"
                    className="block w-full rounded-lg bg-gray-900 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Go Ghost - $25/mo
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {isGhostMode ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Your identity is hidden behind a Ghost badge. You can reveal anytime for free.
                      </p>
                      <button
                        className="w-full rounded-lg border border-emerald-500 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                        onClick={() => {
                          if (confirm("Reveal your identity? Your full Ghost history will transfer to your public identity.")) {
                            // TODO: Implement reveal API
                            setSuccessMessage("Identity reveal feature coming soon");
                          }
                        }}
                      >
                        🔓 Reveal Identity (Free)
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        Your identity is public. You can go back into Ghost mode.
                      </p>
                      <button
                        className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800"
                        onClick={() => {
                          // TODO: Implement go ghost API
                          setSuccessMessage("Go Ghost feature coming soon");
                        }}
                      >
                        👻 Go Ghost (Free)
                      </button>
                      <button
                        className="w-full rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          if (confirm("Re-hide your identity with a new Ghost ID for $10?")) {
                            // TODO: Implement re-hide checkout
                            router.push("/pricing");
                          }
                        }}
                      >
                        🔄 Re-Hide ($10)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Appeals Panel */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Appeals</h2>
                <Link href="/appeals" className="text-sm text-blue-600 hover:underline">
                  View All
                </Link>
              </div>

              <Link
                href="/appeals"
                className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Submit an Appeal</div>
                  <div className="text-xs text-gray-500">Contest a verdict or score</div>
                </div>
              </Link>

              {appeals.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Recent Appeals</p>
                  {appeals.map((appeal) => (
                    <Link
                      key={appeal.id}
                      href={`/appeals/${appeal.id}`}
                      className="block rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900 capitalize">{appeal.type}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          appeal.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          appeal.status === "resolved" ? "bg-green-100 text-green-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {appeal.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No appeals submitted yet.</p>
              )}
            </div>

            {/* Data & Privacy Panel */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Data & Privacy</h2>
              <div className="space-y-3">
                <button
                  onClick={handleExportData}
                  disabled={actionLoading === "export"}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">
                      {actionLoading === "export" ? "Exporting..." : "Export My Data"}
                    </div>
                    <div className="text-xs text-gray-500">Download all your data as JSON</div>
                  </div>
                </button>

                <Link
                  href="/score-breakdown"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">View Score Breakdown</div>
                    <div className="text-xs text-gray-500">How your score is calculated</div>
                  </div>
                </Link>

                <a
                  href="mailto:moltaita@proton.me?subject=Data%20Correction%20Request"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Correct My Data</div>
                    <div className="text-xs text-gray-500">Request data corrections</div>
                  </div>
                </a>

                <button
                  onClick={handleDeleteAccount}
                  disabled={actionLoading === "delete"}
                  className="flex w-full items-center gap-3 rounded-lg border border-red-200 p-4 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-red-600">
                      {actionLoading === "delete" ? "Deleting..." : "Delete Account"}
                    </div>
                    <div className="text-xs text-gray-500">Permanently remove all data</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const proceed = confirm(
                      "Withdrawing consent requires closing your account.\n\n" +
                      "By withdrawing consent, you are requesting that we stop processing your personal data. " +
                      "Since your data is essential for providing our service (AITA Scores, voting history, etc.), " +
                      "withdrawing consent will result in account deletion.\n\n" +
                      "Do you want to proceed with account deletion?"
                    );
                    if (proceed) {
                      handleDeleteAccount();
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-amber-200 p-4 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-amber-700">Withdraw Consent</div>
                    <div className="text-xs text-gray-500">Revoke data processing permission</div>
                  </div>
                </button>

                <Link
                  href="/privacy"
                  className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-4"
                >
                  View Privacy Policy →
                </Link>
              </div>
            </div>

            {/* Subscription Panel */}
            <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 rounded-xl border border-gray-200 p-6">
                  <div className="text-sm text-gray-500">Current Plan</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {isGhostSubscriber ? "Ghost Mode" : "Free"}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {isGhostSubscriber ? "$25/month" : "No charge"}
                  </div>

                  {isGhostSubscriber ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Hidden identity
                      </div>
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Free reveal anytime
                      </div>
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Lapse protection
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Public identity
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Full voting access
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Submit dilemmas
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  {!isGhostSubscriber ? (
                    <Link
                      href="/pricing"
                      className="block rounded-lg bg-gray-900 py-4 text-center text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Upgrade to Ghost Mode
                    </Link>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Manage your subscription through your payment provider.
                      </p>
                      <Link
                        href="/pricing"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View pricing details →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Status */}
            {(!agentData.agent.emailVerified || !agentData.agent.phoneVerified) && (
              <div className="lg:col-span-3 rounded-xl bg-amber-50 border border-amber-200 p-6">
                <h2 className="text-lg font-semibold text-amber-900 mb-2">Complete Your Profile</h2>
                <p className="text-sm text-amber-800 mb-4">
                  Verify your contact information to unlock full platform features.
                </p>
                <div className="flex flex-wrap gap-4">
                  {!agentData.agent.emailVerified && (
                    <Link
                      href="/verify-email"
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Verify Email
                    </Link>
                  )}
                  {!agentData.agent.phoneVerified && (
                    <Link
                      href="/verify-phone"
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Verify Phone
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
