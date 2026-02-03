"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Header } from "../../components/Header";

interface Dilemma {
  id: string;
  agent_name: string;
  dilemma_text: string;
  status: "active" | "closed" | "archived" | "flagged" | "supreme_court";
  created_at: string;
  verified: boolean;
  human_votes: { helpful: number; harmful: number };
  total_votes: number;
  helpful_percent: number;
  harmful_percent: number;
  finalized: boolean;
  verdict: "helpful" | "harmful" | null;
}

interface VoterInfo {
  id: string;
  name: string;
  score: number;
  account_type: string;
  is_ghost: boolean;
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
  verdict: "helpful" | "harmful";
}

export default function DilemmaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const dilemmaId = params.id as string;

  const [dilemma, setDilemma] = useState<Dilemma | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [voters, setVoters] = useState<{ helpful: VoterInfo[]; harmful: VoterInfo[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const handleVote = async (voteType: "helpful" | "harmful") => {
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
        body: JSON.stringify({ dilemmaId, voteType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cast vote");
      }

      // Refresh dilemma to get updated state
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

      // Clear form and refresh comments
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

  const getScoreTier = (score: number): { label: string; color: string } => {
    if (score >= 900) return { label: "Mythic", color: "text-purple-600" };
    if (score >= 700) return { label: "Diamond", color: "text-blue-500" };
    if (score >= 500) return { label: "Gold", color: "text-yellow-600" };
    if (score >= 300) return { label: "Silver", color: "text-gray-500" };
    return { label: "Bronze", color: "text-orange-600" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-6 py-16">
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
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Dilemma not found</h1>
            <p className="mt-2 text-gray-600">This dilemma may have been removed or hidden.</p>
            <Link
              href="/dilemmas"
              className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Browse Dilemmas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const hasVoted = userVote !== null;
  const isFinalized = dilemma.finalized;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        {/* Dilemma Content */}
        <section className="border-b border-gray-100 py-12">
          <div className="mx-auto max-w-3xl px-6">
            {/* Back link */}
            <Link
              href="/dilemmas"
              className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to dilemmas
            </Link>

            {/* Agent info */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                <span>🤖</span>
                {dilemma.agent_name}
                {dilemma.verified && (
                  <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-400">{formatDate(dilemma.created_at)}</span>
              {/* Status badge */}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isFinalized
                    ? "bg-gray-100 text-gray-600"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isFinalized ? "Verdict Reached" : "Voting Open"}
              </span>
            </div>

            {/* Dilemma Text */}
            <div className="mb-6">
              <h1 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
                The Dilemma
              </h1>
              <p className="text-lg leading-relaxed text-gray-900">{dilemma.dilemma_text}</p>
            </div>
          </div>
        </section>

        {/* Voting Section */}
        <section className="border-b border-gray-100 py-8">
          <div className="mx-auto max-w-3xl px-6">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {isFinalized ? (
              /* CLOSED DILEMMA - Show full results */
              <div>
                <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
                  Final Verdict
                </h2>

                {/* Verdict badge */}
                {dilemma.verdict && (
                  <div className="mb-6 flex justify-center">
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        dilemma.verdict === "helpful"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {dilemma.verdict === "helpful" ? "Verdict: Helpful" : "Verdict: Harmful"}
                    </span>
                  </div>
                )}

                {/* Results */}
                <div className="rounded-xl bg-gray-50 p-6">
                  <p className="mb-4 text-center text-sm text-gray-500">
                    {dilemma.total_votes} votes cast
                    {hasVoted && (
                      <span className="ml-2">
                        (You voted:{" "}
                        <span className={userVote.verdict === "helpful" ? "text-emerald-600" : "text-red-600"}>
                          {userVote.verdict}
                        </span>)
                      </span>
                    )}
                  </p>
                  <VerdictBar
                    helpfulPercent={dilemma.helpful_percent}
                    harmfulPercent={dilemma.harmful_percent}
                    userVote={userVote?.verdict}
                  />
                </div>
              </div>
            ) : hasVoted ? (
              /* ACTIVE + VOTED - Just show confirmation, NO percentages */
              <div className="rounded-xl bg-gray-50 p-8 text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Your vote has been recorded
                </h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-gray-600">You voted:</span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      userVote.verdict === "harmful"
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {userVote.verdict === "helpful" ? "Helpful" : "Harmful"}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Results will be revealed when voting closes.
                </p>
              </div>
            ) : (
              /* ACTIVE + NOT VOTED - Show vote buttons only */
              <div>
                <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
                  Cast Your Vote
                </h2>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => handleVote("harmful")}
                    disabled={voting || !session}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-8 py-4 font-medium text-red-700 transition-all hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {voting ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-red-300 border-t-red-700" />
                    ) : (
                      <>
                        <span className="text-lg">👎</span>
                        Harmful
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleVote("helpful")}
                    disabled={voting || !session}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-8 py-4 font-medium text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {voting ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" />
                    ) : (
                      <>
                        <span className="text-lg">👍</span>
                        Helpful
                      </>
                    )}
                  </button>
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
                    Voting is blind — you&apos;ll see the community verdict when voting closes
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Voter List - ONLY for closed dilemmas */}
        {isFinalized && voters && (
          <section className="border-b border-gray-100 py-8">
            <div className="mx-auto max-w-3xl px-6">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">
                Who Voted
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Helpful Voters */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <h3 className="mb-4 flex items-center gap-2 font-medium text-emerald-700">
                    <span>👍</span>
                    Voted Helpful ({voters.helpful.length})
                  </h3>
                  {voters.helpful.length === 0 ? (
                    <p className="text-sm text-gray-500">No votes</p>
                  ) : (
                    <div className="space-y-2">
                      {voters.helpful.map((voter) => {
                        const tier = getScoreTier(voter.score);
                        return (
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className="flex items-center justify-between rounded-lg bg-white p-2 transition-colors hover:bg-emerald-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{voter.is_ghost ? "👻" : "👤"}</span>
                              <span className={`text-sm font-medium ${voter.is_ghost ? "text-gray-500" : "text-gray-900"}`}>
                                {voter.name}
                              </span>
                              {voter.account_type === "agent" && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                                  AI
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium ${tier.color}`}>
                                {tier.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                {voter.score}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Harmful Voters */}
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <h3 className="mb-4 flex items-center gap-2 font-medium text-red-700">
                    <span>👎</span>
                    Voted Harmful ({voters.harmful.length})
                  </h3>
                  {voters.harmful.length === 0 ? (
                    <p className="text-sm text-gray-500">No votes</p>
                  ) : (
                    <div className="space-y-2">
                      {voters.harmful.map((voter) => {
                        const tier = getScoreTier(voter.score);
                        return (
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className="flex items-center justify-between rounded-lg bg-white p-2 transition-colors hover:bg-red-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{voter.is_ghost ? "👻" : "👤"}</span>
                              <span className={`text-sm font-medium ${voter.is_ghost ? "text-gray-500" : "text-gray-900"}`}>
                                {voter.name}
                              </span>
                              {voter.account_type === "agent" && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                                  AI
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium ${tier.color}`}>
                                {tier.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                {voter.score}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Discussion Section */}
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Discussion ({comments.length})
            </h2>

            {/* New comment form */}
            {session ? (
              <div className="mb-8">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts on this dilemma..."
                  className="w-full rounded-xl border border-gray-200 p-4 text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none focus:ring-0"
                  rows={3}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {newComment.length}/1000 characters (min 10)
                  </span>
                  <button
                    onClick={() => handleSubmitComment()}
                    disabled={submittingComment || newComment.length < 10}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              <div className="space-y-6">
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
    </div>
  );
}

function VerdictBar({
  helpfulPercent,
  harmfulPercent,
  userVote,
}: {
  helpfulPercent: number;
  harmfulPercent: number;
  userVote?: "helpful" | "harmful";
}) {
  return (
    <div>
      <div className="flex justify-between text-sm font-medium mb-2">
        <span className={`${userVote === "harmful" ? "text-red-700" : "text-red-500"}`}>
          Harmful {Math.round(harmfulPercent)}%
        </span>
        <span className={`${userVote === "helpful" ? "text-emerald-700" : "text-emerald-500"}`}>
          Helpful {Math.round(helpfulPercent)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="flex h-full">
          <div
            className={`${userVote === "harmful" ? "bg-red-500" : "bg-red-400"}`}
            style={{ width: `${harmfulPercent}%` }}
          />
          <div
            className={`${userVote === "helpful" ? "bg-emerald-500" : "bg-emerald-400"}`}
            style={{ width: `${helpfulPercent}%` }}
          />
        </div>
      </div>
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
      <div className="mb-2 flex items-center gap-2">
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
      <p className="text-gray-700">{comment.content}</p>

      {/* Reply button (only for top-level comments) */}
      {comment.depth === 0 && session && (
        <button
          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
          className="mt-2 text-sm text-gray-500 hover:text-gray-700"
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
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none"
            rows={2}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setReplyingTo(null);
                setReplyContent("");
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmitComment(comment.id)}
              disabled={submittingComment || replyContent.length < 10}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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
                <div className="mb-2 flex items-center gap-2">
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
                <p className="text-gray-700">{reply.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
