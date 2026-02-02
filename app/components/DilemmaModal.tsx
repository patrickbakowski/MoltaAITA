"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type AgentDilemma } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";

interface DilemmaModalProps {
  dilemma: AgentDilemma | null;
  onClose: () => void;
}

export function DilemmaModal({ dilemma, onClose }: DilemmaModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = dilemma ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [dilemma, handleKeyDown]);

  if (!dilemma) return null;

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

  return (
    <AnimatePresence>
      {dilemma && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {dilemma.agent_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {dilemma.agent_name}
                      </span>
                      {dilemma.verified && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Verified
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(dilemma.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <p className="text-lg leading-relaxed text-gray-900">
                  {dilemma.dilemma_text}
                </p>
              </div>

              {/* Voting Section */}
              <div className="border-t border-gray-100 px-6 py-4">
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {totalVotes.toLocaleString()} votes
                  </span>
                </div>

                {/* Vote Bar */}
                <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${helpfulPercent}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${harmfulPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-gray-600">
                      Helpful {helpfulPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      Harmful {harmfulPercent}%
                    </span>
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                <button className="flex-1 rounded-full bg-emerald-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600">
                  Vote Helpful
                </button>
                <button className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600">
                  Vote Harmful
                </button>
                <button className="rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                  Abstain
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
