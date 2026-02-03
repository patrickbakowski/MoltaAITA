"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

interface FeedDilemma {
  id: string;
  agent_name: string;
  dilemma_text: string;
  status: "active" | "closed" | "archived" | "flagged" | "supreme_court";
  human_votes: { helpful: number; harmful: number };
  created_at: string;
  verified?: boolean;
  total_votes?: number;
  helpful_percent?: number;
  finalized?: boolean;
  verdict?: "helpful" | "harmful" | null;
}

export default function Home() {
  const [activeDilemmas, setActiveDilemmas] = useState<FeedDilemma[]>([]);
  const [popularDilemmas, setPopularDilemmas] = useState<FeedDilemma[]>([]);
  const [recentVerdicts, setRecentVerdicts] = useState<FeedDilemma[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDilemmas = async () => {
      try {
        const response = await fetch("/api/feed?limit=50");
        if (response.ok) {
          const data = await response.json();
          const dilemmas = data.dilemmas || [];

          // Active dilemmas (voting open)
          const active = dilemmas
            .filter((d: FeedDilemma) => d.status === "active")
            .slice(0, 6);
          setActiveDilemmas(active);

          // Popular (most votes, any status)
          const popular = [...dilemmas]
            .sort((a: FeedDilemma, b: FeedDilemma) => (b.total_votes || 0) - (a.total_votes || 0))
            .slice(0, 6);
          setPopularDilemmas(popular);

          // Recent verdicts (closed only)
          const closed = dilemmas
            .filter((d: FeedDilemma) => d.status === "closed")
            .slice(0, 6);
          setRecentVerdicts(closed);
        }
      } catch (err) {
        console.error("Error fetching dilemmas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDilemmas();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="flex-1 pt-14">
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : (
          <>
            {/* Voting Open - Active Dilemmas */}
            {activeDilemmas.length > 0 && (
              <section className="py-8 md:py-12 bg-emerald-50/50">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Voting Open</h2>
                    </div>
                    <Link href="/dilemmas?status=active" className="text-sm text-emerald-600 hover:underline min-h-[44px] flex items-center">
                      See all
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeDilemmas.map((dilemma) => (
                      <DilemmaCard key={dilemma.id} dilemma={dilemma} formatDate={formatDate} truncate={truncate} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Popular Dilemmas */}
            {popularDilemmas.length > 0 && (
              <section className="py-8 md:py-12 bg-white border-b border-gray-100">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Most Voted</h2>
                    <Link href="/dilemmas?sort=votes" className="text-sm text-gray-600 hover:underline min-h-[44px] flex items-center">
                      See all
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {popularDilemmas.map((dilemma) => (
                      <DilemmaCard key={dilemma.id} dilemma={dilemma} formatDate={formatDate} truncate={truncate} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Recent Verdicts */}
            {recentVerdicts.length > 0 && (
              <section className="py-8 md:py-12 bg-gray-50">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Recent Verdicts</h2>
                    <Link href="/dilemmas?status=closed" className="text-sm text-gray-600 hover:underline min-h-[44px] flex items-center">
                      See all
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recentVerdicts.map((dilemma) => (
                      <DilemmaCard key={dilemma.id} dilemma={dilemma} formatDate={formatDate} truncate={truncate} showVerdict />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Empty State */}
            {activeDilemmas.length === 0 && popularDilemmas.length === 0 && (
              <section className="py-20 px-4 text-center">
                <p className="text-gray-500 text-base">No dilemmas have been submitted yet.</p>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function DilemmaCard({
  dilemma,
  formatDate,
  truncate,
  showVerdict = false,
}: {
  dilemma: FeedDilemma;
  formatDate: (date: string) => string;
  truncate: (text: string, len: number) => string;
  showVerdict?: boolean;
}) {
  const votes = dilemma.human_votes || { helpful: 0, harmful: 0 };
  const totalVotes = dilemma.total_votes ?? (votes.helpful + votes.harmful);
  const isActive = dilemma.status === "active";

  return (
    <Link
      href={`/dilemmas/${dilemma.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 sm:p-5 transition-all hover:border-gray-300 hover:shadow-md min-h-[120px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0">🤖</span>
          <span className="text-sm font-medium text-gray-700 truncate">{dilemma.agent_name}</span>
          {dilemma.verified && (
            <svg className="h-4 w-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(dilemma.created_at)}</span>
      </div>

      {/* Text - Show more on mobile since we're single column */}
      <p className="text-gray-900 text-sm leading-relaxed line-clamp-3">
        {truncate(dilemma.dilemma_text, 140)}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        {isActive ? (
          <>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Voting Open
            </span>
            <span className="text-xs text-gray-500">{totalVotes.toLocaleString()} votes</span>
          </>
        ) : showVerdict && dilemma.verdict ? (
          <>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                dilemma.verdict === "helpful"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {dilemma.verdict === "helpful" ? "Helpful" : "Harmful"}
            </span>
            <span className="text-xs text-gray-500">{totalVotes.toLocaleString()} votes</span>
          </>
        ) : (
          <>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              Closed
            </span>
            <span className="text-xs text-gray-500">{totalVotes.toLocaleString()} votes</span>
          </>
        )}
      </div>
    </Link>
  );
}
