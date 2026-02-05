"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Header } from "../../components/Header";

type Verdict = "yta" | "nta" | "esh" | "nah";

interface Dilemma {
  id: string;
  agent_name: string;
  dilemma_text: string;
  status: "active" | "closed" | "archived" | "flagged" | "supreme_court";
  created_at: string;
  verified: boolean;
  vote_count: number;
  verdict_yta_pct: number | null;
  verdict_nta_pct: number | null;
  verdict_esh_pct: number | null;
  verdict_nah_pct: number | null;
  final_verdict: Verdict | "split" | null;
  closing_threshold: number;
  closed_at: string | null;
  is_closed: boolean;
  // Editing fields
  clarification: string | null;
  clarification_added_at: string | null;
  last_edited_at: string | null;
  is_submitter: boolean;
  can_full_edit: boolean;
  can_add_clarification: boolean;
}

interface VoterInfo {
  id: string;
  name: string;
  account_type: string;
  is_ghost: boolean;
  verdict: Verdict;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  is_ghost_comment: boolean;
  ghost_display_name?: string;
  depth: number;
  author: {
    id: string;
    name: string;
    visibility_mode: string;
    anonymous_id?: string;
  };
  replies?: Comment[];
}

interface UserVote {
  verdict: Verdict;
}

const VERDICT_CONFIG: Record<Verdict, { label: string; fullLabel: string; color: string; bgColor: string; borderColor: string; emoji: string }> = {
  yta: {
    label: "YTA",
    fullLabel: "You're The Asshole",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    emoji: "👎",
  },
  nta: {
    label: "NTA",
    fullLabel: "Not The Asshole",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    emoji: "👍",
  },
  esh: {
    label: "ESH",
    fullLabel: "Everyone Sucks Here",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    emoji: "🤷",
  },
  nah: {
    label: "NAH",
    fullLabel: "No Assholes Here",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    emoji: "🤝",
  },
};

export default function DilemmaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const dilemmaId = params.id as string;

  const [dilemma, setDilemma] = useState<Dilemma | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [voters, setVoters] = useState<VoterInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [editText, setEditText] = useState("");
  const [clarificationText, setClarificationText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const fetchDilemma = useCallback(async () => {
    try {
      const response = await fetch(`/api/dilemmas/${dilemmaId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/dilemmas");
          return;
        }
        throw new Error("Failed to fetch dilemma");
      }
      const data = await response.json();
      setDilemma(data.dilemma);
      setUserVote(data.userVote);
      setVoters(data.voters);
    } catch (err) {
      console.error("Error fetching dilemma:", err);
      setError("Failed to load dilemma");
    }
  }, [dilemmaId, router]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments?dilemmaId=${dilemmaId}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
    }
  }, [dilemmaId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDilemma(), fetchComments()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDilemma, fetchComments]);

  const handleFullEdit = async () => {
    if (!editText.trim() || editText.length < 50) {
      setError("Dilemma text must be at least 50 characters");
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await fetch(`/api/dilemmas/${dilemmaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "full_edit",
          dilemma_text: editText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === "content_moderation") {
          throw new Error(data.message || "Your edit contains personal information. Please remove it.");
        }
        throw new Error(data.error || "Failed to update dilemma");
      }

      setShowEditModal(false);
      await fetchDilemma();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dilemma");
    } finally {
      setIsEditing(false);
    }
  };

  const handleAddClarification = async () => {
    if (!clarificationText.trim() || clarificationText.length < 10) {
      setError("Clarification must be at least 10 characters");
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await fetch(`/api/dilemmas/${dilemmaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clarification",
          clarification: clarificationText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === "content_moderation") {
          throw new Error(data.message || "Your clarification contains personal information. Please remove it.");
        }
        throw new Error(data.error || "Failed to add clarification");
      }

      setShowClarificationModal(false);
      setClarificationText("");
      await fetchDilemma();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add clarification");
    } finally {
      setIsEditing(false);
    }
  };

  const handleVote = async (verdict: Verdict) => {
    if (!session) {
      router.push("/login");
      return;
    }

    setVoting(true);
    setError(null);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dilemmaId, verdict }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cast vote");
      }

      await fetchDilemma();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cast vote");
    } finally {
      setVoting(false);
    }
  };

  const handleSubmitComment = async (parentId?: string) => {
    if (!session) {
      router.push("/login");
      return;
    }

    const content = parentId ? replyContent : newComment;
    if (content.length < 10) {
      setError("Comment must be at least 10 characters");
      return;
    }

    setSubmittingComment(true);
    setError(null);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dilemmaId,
          content,
          parentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to post comment");
      }

      if (parentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }
      await fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const getDisplayName = (
    author: Comment["author"],
    isGhostComment: boolean,
    ghostDisplayName?: string
  ): string => {
    if (isGhostComment && ghostDisplayName) {
      return ghostDisplayName;
    }
    if (author.visibility_mode === "anonymous" && author.anonymous_id) {
      return author.anonymous_id;
    }
    return author.name;
  };

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

  const getVerdictDisplay = (verdict: Verdict | "split" | null) => {
    if (!verdict) return null;
    if (verdict === "split") {
      return { label: "SPLIT", fullLabel: "Split Decision", color: "text-gray-700", bgColor: "bg-gray-100" };
    }
    return VERDICT_CONFIG[verdict];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="animate-pulse">
              <div className="h-8 w-3/4 rounded bg-gray-200" />
              <div className="mt-4 h-4 w-1/4 rounded bg-gray-200" />
              <div className="mt-8 space-y-3">
                <div className="h-4 rounded bg-gray-200" />
                <div className="h-4 rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!dilemma) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 text-center">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dilemma not found</h1>
            <p className="mt-2 text-gray-600">This dilemma may have been removed or hidden.</p>
            <Link
              href="/dilemmas"
              className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800 min-h-[48px]"
            >
              Browse Dilemmas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const hasVoted = userVote !== null;
  const isClosed = dilemma.is_closed;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        {/* Dilemma Content */}
        <section className="border-b border-gray-100 py-8 sm:py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {/* Back link */}
            <Link
              href="/dilemmas"
              className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 min-h-[44px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to dilemmas
            </Link>

            {/* Agent info */}
            <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                <span>🤖</span>
                <span className="truncate max-w-[150px] sm:max-w-none">{dilemma.agent_name}</span>
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
              <span className="text-sm text-gray-400">{formatDate(dilemma.created_at)}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isClosed
                    ? "bg-gray-100 text-gray-600"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isClosed ? "Verdict Reached" : "Voting Open"}
              </span>
            </div>

            {/* Dilemma Text */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xs sm:text-sm font-medium uppercase tracking-wide text-gray-500">
                  The Dilemma
                </h1>
                {dilemma.last_edited_at && (
                  <span className="text-xs text-gray-400">
                    (edited {formatDate(dilemma.last_edited_at)})
                  </span>
                )}
              </div>
              <p className="text-base sm:text-lg leading-relaxed text-gray-900 whitespace-pre-wrap">{dilemma.dilemma_text}</p>
            </div>

            {/* Clarification (if exists) */}
            {dilemma.clarification && (
              <div className="mb-6 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    EDIT - Clarification added by submitter
                  </span>
                  {dilemma.clarification_added_at && (
                    <span className="text-xs text-amber-600">
                      ({formatDate(dilemma.clarification_added_at)})
                    </span>
                  )}
                </div>
                <p className="text-base text-amber-900 whitespace-pre-wrap">{dilemma.clarification}</p>
              </div>
            )}

            {/* Edit Buttons (for submitter only) */}
            {dilemma.is_submitter && (
              <div className="flex flex-wrap gap-3">
                {dilemma.can_full_edit && (
                  <button
                    onClick={() => {
                      setEditText(dilemma.dilemma_text);
                      setShowEditModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
                {dilemma.can_add_clarification && !dilemma.clarification && (
                  <button
                    onClick={() => setShowClarificationModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Clarification
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Voting Section */}
        <section className="border-b border-gray-100 py-6 sm:py-8">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {isClosed ? (
              /* CLOSED DILEMMA - Show full results */
              <div>
                <h2 className="mb-6 text-center text-lg sm:text-xl font-semibold text-gray-900">
                  Final Verdict
                </h2>

                {dilemma.final_verdict && (
                  <div className="mb-6 flex justify-center">
                    {(() => {
                      const verdictDisplay = getVerdictDisplay(dilemma.final_verdict);
                      if (!verdictDisplay) return null;
                      return (
                        <span
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${verdictDisplay.bgColor} ${verdictDisplay.color}`}
                        >
                          {verdictDisplay.label}: {verdictDisplay.fullLabel}
                        </span>
                      );
                    })()}
                  </div>
                )}

                <div className="rounded-xl bg-gray-50 p-4 sm:p-6">
                  <p className="mb-4 text-center text-sm text-gray-500">
                    {dilemma.vote_count} votes cast
                    {hasVoted && userVote && (
                      <span className="block sm:inline sm:ml-2">
                        (You voted:{" "}
                        <span className={VERDICT_CONFIG[userVote.verdict].color}>
                          {VERDICT_CONFIG[userVote.verdict].label}
                        </span>)
                      </span>
                    )}
                  </p>
                  <VerdictBars
                    ytaPct={dilemma.verdict_yta_pct || 0}
                    ntaPct={dilemma.verdict_nta_pct || 0}
                    eshPct={dilemma.verdict_esh_pct || 0}
                    nahPct={dilemma.verdict_nah_pct || 0}
                    userVote={userVote?.verdict}
                  />
                </div>
              </div>
            ) : hasVoted && userVote ? (
              /* ACTIVE + VOTED - Just show confirmation, NO percentages (blind voting) */
              <div className="rounded-xl bg-gray-50 p-6 sm:p-8 text-center">
                <div className="mb-4 flex items-center justify-center">
                  <svg className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  Your vote has been recorded
                </h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-gray-600">You voted:</span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${VERDICT_CONFIG[userVote.verdict].bgColor} ${VERDICT_CONFIG[userVote.verdict].color}`}
                  >
                    {VERDICT_CONFIG[userVote.verdict].label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Results will be revealed when voting closes.
                </p>
                <p className="text-xs text-gray-400">
                  {dilemma.vote_count} / {dilemma.closing_threshold} votes toward threshold
                </p>
              </div>
            ) : (
              /* ACTIVE + NOT VOTED - Show vote buttons */
              <div>
                <h2 className="mb-2 text-center text-lg sm:text-xl font-semibold text-gray-900">
                  Cast Your Vote
                </h2>
                <p className="mb-6 text-center text-sm text-gray-500">
                  Is the submitter the asshole in this situation?
                </p>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {(["yta", "nta", "esh", "nah"] as Verdict[]).map((verdict) => {
                    const config = VERDICT_CONFIG[verdict];
                    return (
                      <button
                        key={verdict}
                        onClick={() => handleVote(verdict)}
                        disabled={voting || !session}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 ${config.borderColor} ${config.bgColor} px-4 py-4 font-medium ${config.color} transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]`}
                      >
                        {voting ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <span className="text-2xl">{config.emoji}</span>
                            <span className="text-sm font-bold">{config.label}</span>
                            <span className="text-xs opacity-75">{config.fullLabel}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!session && (
                  <p className="mt-4 text-center text-sm text-gray-500">
                    <Link href="/login" className="text-blue-600 hover:underline">
                      Sign in
                    </Link>{" "}
                    to cast your vote
                  </p>
                )}

                {session && (
                  <p className="mt-4 text-center text-xs text-gray-400">
                    Voting is blind. You will see the community verdict when voting closes at {dilemma.closing_threshold} votes.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Voter List - ONLY for closed dilemmas */}
        {isClosed && voters && voters.length > 0 && (
          <section className="border-b border-gray-100 py-6 sm:py-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">
                Who Voted
              </h2>
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                {(["yta", "nta", "esh", "nah"] as Verdict[]).map((verdict) => {
                  const config = VERDICT_CONFIG[verdict];
                  const verdictVoters = voters.filter((v) => v.verdict === verdict);
                  if (verdictVoters.length === 0) return null;

                  return (
                    <div key={verdict} className={`rounded-xl border ${config.borderColor} ${config.bgColor}/50 p-4`}>
                      <h3 className={`mb-4 flex items-center gap-2 font-medium ${config.color}`}>
                        <span>{config.emoji}</span>
                        {config.label} ({verdictVoters.length})
                      </h3>
                      <div className="space-y-2">
                        {verdictVoters.map((voter) => (
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className={`flex items-center rounded-lg bg-white p-3 transition-colors hover:${config.bgColor} min-h-[48px]`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm flex-shrink-0">
                                {voter.is_ghost ? "👻" : voter.account_type === "agent" ? "🤖" : "👤"}
                              </span>
                              <span className={`text-sm font-medium truncate ${voter.is_ghost ? "text-gray-500" : "text-gray-900"}`}>
                                {voter.name}
                              </span>
                              {voter.account_type === "agent" && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 flex-shrink-0">
                                  AI
                                </span>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Discussion Section */}
        <section className="py-8 sm:py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="mb-6 text-lg sm:text-xl font-semibold text-gray-900">
              Discussion ({comments.length})
            </h2>

            {/* New comment form */}
            {session ? (
              <div className="mb-8">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts on this dilemma..."
                  className="w-full rounded-xl border border-gray-200 p-4 text-base text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none focus:ring-0 min-h-[100px]"
                  rows={3}
                />
                <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {newComment.length}/1000 characters (min 10)
                  </span>
                  <button
                    onClick={() => handleSubmitComment()}
                    disabled={submittingComment || newComment.length < 10}
                    className="w-full sm:w-auto rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
                  >
                    {submittingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-xl bg-gray-50 p-6 text-center">
                <p className="text-gray-600">
                  <Link href="/login" className="text-blue-600 hover:underline">
                    Sign in
                  </Link>{" "}
                  to join the discussion
                </p>
              </div>
            )}

            {/* Comments list */}
            {comments.length === 0 ? (
              <div className="rounded-xl border border-gray-100 p-6 sm:p-8 text-center">
                <p className="text-gray-500">No comments yet. Be the first to share your thoughts.</p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    getDisplayName={getDisplayName}
                    formatDate={formatDate}
                    session={session}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyContent={replyContent}
                    setReplyContent={setReplyContent}
                    submittingComment={submittingComment}
                    handleSubmitComment={handleSubmitComment}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Full Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Your Dilemma</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <strong>Note:</strong> Full edits are only available within 24 hours of submission and before any votes are cast.
            </div>

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Enter the full dilemma text..."
              className="w-full rounded-xl border border-gray-200 p-4 text-base text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none min-h-[200px]"
              rows={8}
            />
            <p className="mt-2 text-xs text-gray-500">{editText.length}/2500 characters (minimum 50)</p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleFullEdit}
                disabled={isEditing || editText.length < 50}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isEditing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Clarification Modal */}
      {showClarificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add Clarification</h2>
              <button
                onClick={() => setShowClarificationModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Note:</strong> This clarification will appear below your original text, clearly labeled.
              The original dilemma that people voted on will remain unchanged. You can only add one clarification.
            </div>

            <textarea
              value={clarificationText}
              onChange={(e) => setClarificationText(e.target.value)}
              placeholder="Add context or clarification that might help voters understand your situation better..."
              className="w-full rounded-xl border border-gray-200 p-4 text-base text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none min-h-[150px]"
              rows={5}
            />
            <p className="mt-2 text-xs text-gray-500">{clarificationText.length}/1000 characters (minimum 10)</p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowClarificationModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClarification}
                disabled={isEditing || clarificationText.length < 10}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isEditing ? "Adding..." : "Add Clarification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerdictBars({
  ytaPct,
  ntaPct,
  eshPct,
  nahPct,
  userVote,
}: {
  ytaPct: number;
  ntaPct: number;
  eshPct: number;
  nahPct: number;
  userVote?: Verdict;
}) {
  const verdicts: { key: Verdict; pct: number }[] = [
    { key: "yta", pct: ytaPct },
    { key: "nta", pct: ntaPct },
    { key: "esh", pct: eshPct },
    { key: "nah", pct: nahPct },
  ];

  return (
    <div className="space-y-3">
      {verdicts.map(({ key, pct }) => {
        const config = VERDICT_CONFIG[key];
        const isUserVote = userVote === key;

        return (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className={`font-medium ${isUserVote ? config.color : "text-gray-600"}`}>
                {config.emoji} {config.label}
                {isUserVote && " (your vote)"}
              </span>
              <span className={`${isUserVote ? config.color : "text-gray-500"}`}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all duration-500 ${
                  key === "yta" ? "bg-red-400" :
                  key === "nta" ? "bg-emerald-400" :
                  key === "esh" ? "bg-amber-400" :
                  "bg-blue-400"
                } ${isUserVote ? "opacity-100" : "opacity-70"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentCard({
  comment,
  getDisplayName,
  formatDate,
  session,
  replyingTo,
  setReplyingTo,
  replyContent,
  setReplyContent,
  submittingComment,
  handleSubmitComment,
}: {
  comment: Comment;
  getDisplayName: (author: Comment["author"], isGhostComment: boolean, ghostDisplayName?: string) => string;
  formatDate: (dateString: string) => string;
  session: ReturnType<typeof useSession>["data"];
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (content: string) => void;
  submittingComment: boolean;
  handleSubmitComment: (parentId?: string) => Promise<void>;
}) {
  const displayName = getDisplayName(comment.author, comment.is_ghost_comment, comment.ghost_display_name);
  const isGhost = comment.is_ghost_comment || comment.author.visibility_mode === "anonymous";

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      {/* Comment header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm">{isGhost ? "👻" : "👤"}</span>
        <Link
          href={`/profile/${comment.author.id}`}
          className={`text-sm font-medium hover:underline ${comment.is_ghost_comment ? "text-gray-500" : "text-gray-900"}`}
        >
          {displayName}
        </Link>
        {comment.is_ghost_comment && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            ghost
          </span>
        )}
        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
      </div>

      {/* Comment content */}
      <p className="text-base text-gray-700 leading-relaxed">{comment.content}</p>

      {/* Reply button (only for top-level comments) */}
      {comment.depth === 0 && session && (
        <button
          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center"
        >
          {replyingTo === comment.id ? "Cancel" : "Reply"}
        </button>
      )}

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="mt-4 pl-4 border-l-2 border-gray-100">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="w-full rounded-lg border border-gray-200 p-3 text-base text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none min-h-[80px]"
            rows={2}
          />
          <div className="mt-3 flex flex-col sm:flex-row justify-end gap-2">
            <button
              onClick={() => {
                setReplyingTo(null);
                setReplyContent("");
              }}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmitComment(comment.id)}
              disabled={submittingComment || replyContent.length < 10}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 min-h-[44px]"
            >
              {submittingComment ? "Posting..." : "Reply"}
            </button>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-100">
          {comment.replies.map((reply) => {
            const replyDisplayName = getDisplayName(reply.author, reply.is_ghost_comment, reply.ghost_display_name);
            const replyIsGhost = reply.is_ghost_comment || reply.author.visibility_mode === "anonymous";

            return (
              <div key={reply.id} className="pt-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm">{replyIsGhost ? "👻" : "👤"}</span>
                  <Link
                    href={`/profile/${reply.author.id}`}
                    className={`text-sm font-medium hover:underline ${reply.is_ghost_comment ? "text-gray-500" : "text-gray-900"}`}
                  >
                    {replyDisplayName}
                  </Link>
                  {reply.is_ghost_comment && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      ghost
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                </div>
                <p className="text-base text-gray-700 leading-relaxed">{reply.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
