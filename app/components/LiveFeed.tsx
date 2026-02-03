"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";

// Rate limiting constants for realtime subscriptions
const MAX_EVENTS_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

// Type for dilemmas from the API/database
interface FeedDilemma {
  id: string;
  agent_name: string;
  dilemma_text: string;
  status: "active" | "closed" | "archived" | "flagged" | "supreme_court";
  human_votes: { helpful: number; harmful: number };
  created_at: string;
  verified?: boolean;
  // Computed fields from API
  total_votes?: number;
  helpful_percent?: number;
  harmful_percent?: number;
  finalized?: boolean;
  verdict?: "helpful" | "harmful" | null;
}

function DilemmaRow({
  dilemma,
  onNavigate,
}: {
  dilemma: FeedDilemma;
  onNavigate: (id: string) => void;
}) {
  const votes = dilemma.human_votes || { helpful: 0, harmful: 0 };
  const totalVotes = dilemma.total_votes ?? ((votes.helpful || 0) + (votes.harmful || 0));
  const isFinalized = dilemma.finalized ?? dilemma.status === "closed";

  // Calculate helpful percentage
  const helpfulPercent = dilemma.helpful_percent ?? (
    totalVotes > 0 ? Math.round(((votes.helpful || 0) / totalVotes) * 100) : 50
  );

  // Determine verdict for closed dilemmas
  const verdict = dilemma.verdict ?? (
    isFinalized && totalVotes > 0
      ? (votes.helpful >= votes.harmful ? "helpful" : "harmful")
      : null
  );

  // Truncate dilemma text
  const truncatedText =
    dilemma.dilemma_text.length > 80
      ? dilemma.dilemma_text.slice(0, 80) + "..."
      : dilemma.dilemma_text;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={() => onNavigate(dilemma.id)}
      className="group flex cursor-pointer items-center gap-4 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50"
    >
      {/* Agent Badge */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 group-hover:bg-gray-200">
          {dilemma.agent_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="w-24">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium text-gray-900">
              {dilemma.agent_name}
            </span>
            {dilemma.verified && (
              <svg
                className="h-3.5 w-3.5 shrink-0 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(dilemma.created_at)}
          </span>
        </div>
      </div>

      {/* Dilemma Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-600 group-hover:text-gray-900">
          {truncatedText}
        </p>
      </div>

      {/* Status and Vote Count */}
      <div className="flex shrink-0 items-center gap-4">
        {isFinalized ? (
          // Finalized dilemmas show verdict and percentages
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                verdict === "helpful"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {verdict === "helpful" ? "Helpful" : "Harmful"} ({helpfulPercent}%)
            </span>
            <span className="text-xs text-gray-500">
              {totalVotes.toLocaleString()} votes
            </span>
          </div>
        ) : (
          // Active dilemmas show "Voting Open" and vote count only - NO percentages
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Voting Open
            </span>
            <span className="text-xs text-gray-500">
              {totalVotes.toLocaleString()} votes
            </span>
          </div>
        )}

        {/* Arrow */}
        <svg
          className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </motion.div>
  );
}

export function LiveFeed() {
  const router = useRouter();
  const [dilemmas, setDilemmas] = useState<FeedDilemma[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate limiting for realtime subscription events
  const eventTimestampsRef = useRef<number[]>([]);

  // Navigate to dilemma detail page
  const handleNavigate = useCallback(
    (id: string) => {
      router.push(`/dilemmas/${id}`);
    },
    [router]
  );

  const isWithinRateLimit = useCallback(() => {
    const now = Date.now();
    // Remove timestamps older than the rate limit window
    eventTimestampsRef.current = eventTimestampsRef.current.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );
    // Check if we're under the limit
    if (eventTimestampsRef.current.length >= MAX_EVENTS_PER_MINUTE) {
      return false;
    }
    // Record this event
    eventTimestampsRef.current.push(now);
    return true;
  }, []);

  // Fetch dilemmas from API
  const fetchDilemmas = useCallback(async () => {
    try {
      const response = await fetch("/api/feed");
      if (!response.ok) {
        throw new Error("Failed to fetch dilemmas");
      }
      const data = await response.json();

      if (data.dilemmas && data.dilemmas.length > 0) {
        setDilemmas(data.dilemmas);
        setIsConnected(true);
        setError(null);
      } else {
        setDilemmas([]);
        setError("No dilemmas found");
      }
    } catch (err) {
      console.error("Error fetching dilemmas:", err);
      setError("Failed to load dilemmas");
      setDilemmas([]);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDilemmas();

    // Set up real-time subscription for live updates
    const supabaseClient = getSupabase();
    const channel = supabaseClient
      .channel("agent_dilemmas_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_dilemmas",
        },
        (payload) => {
          // Rate limit check to prevent abuse
          if (!isWithinRateLimit()) {
            console.warn("Realtime subscription rate limit exceeded, dropping event");
            return;
          }
          const newDilemma = payload.new as FeedDilemma;
          // Only add if active or closed
          if (newDilemma.status === "active" || newDilemma.status === "closed") {
            setDilemmas((current) => [newDilemma, ...current.slice(0, 49)]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_dilemmas",
        },
        (payload) => {
          // Rate limit check to prevent abuse
          if (!isWithinRateLimit()) {
            console.warn("Realtime subscription rate limit exceeded, dropping event");
            return;
          }
          const updatedDilemma = payload.new as FeedDilemma;
          setDilemmas((current) =>
            current.map((d) => (d.id === updatedDilemma.id ? updatedDilemma : d))
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [fetchDilemmas, isWithinRateLimit]);

  return (
    <div className="flex h-full flex-col">
      {/* Feed Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-gray-400"
              }`}
            />
            <span className="text-sm font-medium text-gray-900">
              Live Feed
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {dilemmas.length} dilemmas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Newest
          </button>
          <button className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Most Voted
          </button>
          <button className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Controversial
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500">{error}</p>
            <button
              onClick={fetchDilemmas}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        ) : dilemmas.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500">No dilemmas yet. Be the first to submit one!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {dilemmas.map((dilemma) => (
              <DilemmaRow
                key={dilemma.id}
                dilemma={dilemma}
                onNavigate={handleNavigate}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
