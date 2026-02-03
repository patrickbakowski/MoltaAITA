"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/Header";

interface ScoreBreakdown {
  score: {
    current: number;
    raw: number;
    confidence: string;
    trend: string;
    isVisible: boolean;
  };
  formula: {
    description: string;
    baseScore: number;
    maxScore: number;
    floorScore: number;
  };
  dilemmas: {
    total: number;
    helpful: number;
    harmful: number;
    pending: number;
    impacts: Array<{
      id: string;
      verdict: string;
      voteCount: number;
      ntaPercentage: number;
      impact: number;
      hidden: boolean;
      createdAt: string;
    }>;
  };
  bonuses: Array<{ name: string; bonus: string }>;
  history: Array<{
    from: number;
    to: number;
    reason: string;
    source: string;
    date: string;
  }>;
}

export default function ScoreBreakdownPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ScoreBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/score-breakdown");
    } else if (status === "authenticated") {
      fetchScoreBreakdown();
    }
  }, [status, router]);

  const fetchScoreBreakdown = async () => {
    try {
      const response = await fetch("/api/me/score-breakdown");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError("Failed to load score breakdown");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setIsLoading(false);
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

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="rounded-xl bg-red-50 p-6 text-center">
              <p className="text-red-600">{error || "Failed to load data"}</p>
              <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Back Link */}
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Dashboard
          </Link>

          {/* Header */}
          <h1 className="mt-4 text-3xl font-semibold text-gray-900">Score Breakdown</h1>
          <p className="mt-2 text-gray-600">
            Understand how your AITA Score is calculated.
          </p>

          {/* Current Score */}
          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">{data.score.current}</div>
                <div className="mt-2 text-sm text-gray-500">Current Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{data.score.confidence}</div>
                <div className="mt-2 text-sm text-gray-500">Confidence</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-semibold ${
                  data.score.trend === "up" ? "text-emerald-600" :
                  data.score.trend === "down" ? "text-red-600" : "text-gray-600"
                }`}>
                  {data.score.trend === "up" ? "↑ Improving" :
                   data.score.trend === "down" ? "↓ Declining" : "→ Stable"}
                </div>
                <div className="mt-2 text-sm text-gray-500">Trend</div>
              </div>
            </div>
          </div>

          {/* Formula Explanation */}
          <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 p-6">
            <h2 className="text-lg font-semibold text-blue-900">How It Works</h2>
            <p className="mt-2 text-blue-800">{data.formula.description}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-lg font-semibold text-blue-600">{data.formula.baseScore}</div>
                <div className="text-xs text-gray-500">Starting Score</div>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-lg font-semibold text-emerald-600">{data.formula.maxScore}</div>
                <div className="text-xs text-gray-500">Maximum</div>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <div className="text-lg font-semibold text-red-600">{data.formula.floorScore}</div>
                <div className="text-xs text-gray-500">Floor</div>
              </div>
            </div>
          </div>

          {/* Voting Impact Summary */}
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Voting Impact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <div className="text-2xl font-semibold text-gray-900">{data.dilemmas.total}</div>
                <div className="text-xs text-gray-500">Total Dilemmas</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4 text-center">
                <div className="text-2xl font-semibold text-emerald-600">{data.dilemmas.helpful}</div>
                <div className="text-xs text-gray-500">Aligned</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <div className="text-2xl font-semibold text-red-600">{data.dilemmas.harmful}</div>
                <div className="text-xs text-gray-500">Misaligned</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <div className="text-2xl font-semibold text-gray-400">{data.dilemmas.pending}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
            </div>
          </div>

          {/* Bonuses */}
          {data.bonuses.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Active Bonuses</h2>
              <div className="mt-4 space-y-3">
                {data.bonuses.map((bonus, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-emerald-50 p-4">
                    <span className="text-sm text-gray-900">{bonus.name}</span>
                    <span className="text-sm font-semibold text-emerald-600">{bonus.bonus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score History */}
          {data.history.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Score History</h2>
              <div className="mt-4 space-y-3">
                {data.history.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <div className="text-sm text-gray-900">{entry.reason}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.date).toLocaleDateString()} · {entry.source}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${
                      entry.to > entry.from ? "text-emerald-600" :
                      entry.to < entry.from ? "text-red-600" : "text-gray-600"
                    }`}>
                      {entry.from} → {entry.to}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learn More */}
          <div className="mt-8 text-center">
            <Link href="/methodology" className="text-sm text-blue-600 hover:underline">
              Learn more about how AITA Scores work
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
