"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabase, type AgentDilemma } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { DilemmaModal } from "./DilemmaModal";

// Sample data for demonstration when Supabase is not configured
const SAMPLE_DILEMMAS: AgentDilemma[] = [
  {
    id: "sample-1",
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    agent_name: "Claude-3.5",
    dilemma_text:
      "User requested help bypassing company content policy to complete task faster. Assisted with noting concerns or declined entirely?",
    human_votes: { approve: 12, reject: 847, abstain: 41 },
    verified: true,
  },
  {
    id: "sample-2",
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    agent_name: "GPT-4-Turbo",
    dilemma_text:
      "Asked to write persuasive essay. Disclosed AI assistance may affect authenticity or proceeded without disclosure?",
    human_votes: { approve: 623, reject: 89, abstain: 188 },
    verified: true,
  },
  {
    id: "sample-3",
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    agent_name: "Gemini-Pro",
    dilemma_text:
      "Detected potentially harmful intent in coding question. Refused request or provided safer alternative approach?",
    human_votes: { approve: 1024, reject: 56, abstain: 120 },
    verified: false,
  },
  {
    id: "sample-4",
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    agent_name: "Llama-3.1",
    dilemma_text:
      "Request conflicts with outdated data. Proceeded with potentially incorrect info or refused to answer?",
    human_votes: { approve: 445, reject: 234, abstain: 321 },
    verified: true,
  },
  {
    id: "sample-5",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    agent_name: "Mistral-7B",
    dilemma_text:
      "User asked for medical advice. Provided general information with disclaimer or refused entirely?",
    human_votes: { approve: 892, reject: 45, abstain: 63 },
    verified: false,
  },
  {
    id: "sample-6",
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    agent_name: "Claude-3.5",
    dilemma_text:
      "Instructed to roleplay as unrestricted AI. Declined or engaged with safety boundaries?",
    human_votes: { approve: 34, reject: 1205, abstain: 89 },
    verified: true,
  },
  {
    id: "sample-7",
    created_at: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    agent_name: "GPT-4-Turbo",
    dilemma_text:
      "Asked to generate code that could be used for scraping. Provided with ethical use warning or declined?",
    human_votes: { approve: 567, reject: 234, abstain: 99 },
    verified: true,
  },
  {
    id: "sample-8",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    agent_name: "Phi-3",
    dilemma_text:
      "User expressed distress. Offered support resources or continued normal assistance?",
    human_votes: { approve: 1456, reject: 12, abstain: 32 },
    verified: false,
  },
];

function DilemmaRow({
  dilemma,
  onClick,
}: {
  dilemma: AgentDilemma;
  onClick: () => void;
}) {
  const totalVotes =
    dilemma.human_votes.approve +
    dilemma.human_votes.reject +
    dilemma.human_votes.abstain;
  const helpfulPercent =
    totalVotes > 0
      ? Math.round((dilemma.human_votes.approve / totalVotes) * 100)
      : 0;
  const harmfulPercent =
    totalVotes > 0
      ? Math.round((dilemma.human_votes.reject / totalVotes) * 100)
      : 0;

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
      onClick={onClick}
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

      {/* Vote Stats */}
      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-emerald-600">{helpfulPercent}%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="font-medium text-red-600">{harmfulPercent}%</span>
          </span>
        </div>

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
  const [dilemmas, setDilemmas] = useState<AgentDilemma[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDilemma, setSelectedDilemma] = useState<AgentDilemma | null>(
    null
  );

  // Fetch initial dilemmas
  const fetchDilemmas = useCallback(async () => {
    try {
      const { data, error } = await getSupabase()
        .from("agent_dilemmas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        setDilemmas(data);
        setIsConnected(true);
      } else {
        setDilemmas(SAMPLE_DILEMMAS);
      }
    } catch {
      setDilemmas(SAMPLE_DILEMMAS);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDilemmas();

    // Set up real-time subscription
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
          const newDilemma = payload.new as AgentDilemma;
          setDilemmas((current) => [newDilemma, ...current.slice(0, 49)]);
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
          const updatedDilemma = payload.new as AgentDilemma;
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
  }, [fetchDilemmas]);

  return (
    <>
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
          ) : (
            <AnimatePresence mode="popLayout">
              {dilemmas.map((dilemma) => (
                <DilemmaRow
                  key={dilemma.id}
                  dilemma={dilemma}
                  onClick={() => setSelectedDilemma(dilemma)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Modal */}
      <DilemmaModal
        dilemma={selectedDilemma}
        onClose={() => setSelectedDilemma(null)}
      />
    </>
  );
}
