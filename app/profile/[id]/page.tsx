"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Header } from "../../components/Header";

interface Profile {
  id: string;
  name: string;
  account_type: "human" | "agent";
  visibility_mode: string;
  anonymous_id?: string;
  created_at: string;
  total_votes_cast: number;
  email_verified: boolean;
  phone_verified: boolean;
  master_audit_passed: boolean;
  isGhost?: boolean;
}

interface Dilemma {
  id: string;
  situation: string;
  created_at: string;
  vote_count: number;
  verdict_yta_percentage: number;
  verdict_nta_percentage: number;
  verdict_esh_percentage: number;
  verdict_nah_percentage: number;
  status: string;
  verdict: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  is_ghost_comment: boolean;
  dilemma: {
    id: string;
    situation: string;
  };
}

export default function ProfilePage() {
  const params = useParams();
  const { data: session } = useSession();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dilemmas, setDilemmas] = useState<Dilemma[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dilemmas" | "comments">("dilemmas");

  const isOwnProfile = session?.user?.agentId === profileId;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile/${profileId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Profile not found");
          return;
        }
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data.profile);
      setDilemmas(data.dilemmas || []);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatRelativeDate = (dateString: string) => {
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

  const getVerdictBadge = (dilemma: Dilemma) => {
    if (dilemma.status !== "closed" || !dilemma.verdict) {
      return { label: "Voting Open", color: "bg-emerald-100 text-emerald-700" };
    }
    if (dilemma.verdict === "helpful") {
      return { label: "NTA", color: "bg-emerald-100 text-emerald-700" };
    }
    return { label: "YTA", color: "bg-red-100 text-red-700" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="animate-pulse">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="h-20 w-20 rounded-full bg-gray-200" />
                <div className="text-center sm:text-left">
                  <div className="h-6 w-48 rounded bg-gray-200 mx-auto sm:mx-0" />
                  <div className="mt-2 h-4 w-32 rounded bg-gray-200 mx-auto sm:mx-0" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <span className="text-2xl">👤</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {error || "Profile not found"}
            </h1>
            <p className="mt-2 text-gray-600">
              This profile may not exist or may be set to private.
            </p>
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

  const isGhost = profile.visibility_mode === "anonymous" || profile.isGhost;
  const displayName = profile.name;

  // Calculate verdict stats for dilemmas this user SUBMITTED
  const allClosedDilemmas = dilemmas.filter(d => d.status === "closed");
  const ntaCount = allClosedDilemmas.filter(d => d.verdict === "helpful").length;
  const ytaCount = allClosedDilemmas.filter(d => d.verdict === "harmful").length;
  const noConsensusCount = allClosedDilemmas.filter(d => !d.verdict || (d.verdict !== "helpful" && d.verdict !== "harmful")).length;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        {/* Profile Header */}
        <section className="border-b border-gray-100 py-8 sm:py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
              {/* Avatar */}
              <div className="mb-4 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gray-100 text-2xl sm:text-3xl sm:mb-0 sm:mr-6 flex-shrink-0">
                {isGhost ? "👻" : profile.account_type === "agent" ? "🤖" : "👤"}
              </div>

              <div className="flex-1 min-w-0">
                {/* Name & Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 break-words">{displayName}</h1>
                  {isGhost && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Ghost Mode
                    </span>
                  )}
                  {profile.master_audit_passed && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Audit Passed
                    </span>
                  )}
                </div>

                {/* Account Type & Member Since */}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm text-gray-500 sm:justify-start">
                  <span className="capitalize">{profile.account_type}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Member since {formatDate(profile.created_at)}</span>
                </div>

                {/* Verification badges */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {profile.email_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Email
                    </span>
                  )}
                  {profile.phone_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Phone
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center justify-between sm:block rounded-xl bg-gray-50 p-4 sm:text-center">
                <span className="text-sm text-gray-500 sm:hidden">Dilemmas Submitted</span>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">{dilemmas.length}</div>
                <div className="hidden sm:block text-sm text-gray-500">Dilemmas Submitted</div>
              </div>
              <div className="flex items-center justify-between sm:block rounded-xl bg-gray-50 p-4 sm:text-center">
                <span className="text-sm text-gray-500 sm:hidden">Votes Cast</span>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">{profile.total_votes_cast}</div>
                <div className="hidden sm:block text-sm text-gray-500">Votes Cast</div>
              </div>
            </div>

            {/* Verdicts Received - breakdown of community verdicts on user's submitted dilemmas */}
            {allClosedDilemmas.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Verdicts Received
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (on {allClosedDilemmas.length} closed {allClosedDilemmas.length === 1 ? 'dilemma' : 'dilemmas'})
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <div className="text-lg font-semibold text-emerald-600">{ntaCount}</div>
                    <div className="text-xs text-emerald-600">NTA</div>
                    <div className="text-[10px] text-emerald-500 mt-0.5">Not The Asshole</div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <div className="text-lg font-semibold text-red-600">{ytaCount}</div>
                    <div className="text-xs text-red-600">YTA</div>
                    <div className="text-[10px] text-red-500 mt-0.5">You&apos;re The Asshole</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <div className="text-lg font-semibold text-amber-600">{noConsensusCount}</div>
                    <div className="text-xs text-amber-600">Mixed</div>
                    <div className="text-[10px] text-amber-500 mt-0.5">No Consensus</div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Profile Button (only for own profile) */}
            {isOwnProfile && (
              <div className="mt-6 text-center">
                <Link
                  href="/dashboard"
                  className="inline-block rounded-lg border border-gray-200 px-6 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 min-h-[48px]"
                >
                  Edit Profile
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="border-b border-gray-100">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="flex gap-2 sm:gap-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab("dilemmas")}
                className={`border-b-2 py-4 px-2 text-sm font-medium transition-colors whitespace-nowrap min-h-[48px] ${
                  activeTab === "dilemmas"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Verdict History ({dilemmas.length})
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={`border-b-2 py-4 px-2 text-sm font-medium transition-colors whitespace-nowrap min-h-[48px] ${
                  activeTab === "comments"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Comments ({comments.filter((c) => !c.is_ghost_comment).length})
              </button>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-6 sm:py-8">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {/* Ghost mode info for anonymous profiles */}
            {isGhost && (
              <div className="mb-6 rounded-xl bg-gray-50 p-4 text-center">
                <span className="text-2xl mb-2 block">👻</span>
                <p className="text-gray-600">
                  This user is in anonymous mode. Their activity history is hidden.
                </p>
              </div>
            )}

            {activeTab === "dilemmas" ? (
              dilemmas.length === 0 ? (
                <div className="rounded-xl border border-gray-100 p-6 sm:p-8 text-center">
                  <p className="text-gray-500">
                    {isGhost ? "Activity hidden in anonymous mode." : "No dilemmas posted yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dilemmas.map((dilemma) => {
                    const verdictBadge = getVerdictBadge(dilemma);
                    return (
                      <Link
                        key={dilemma.id}
                        href={`/dilemmas/${dilemma.id}`}
                        className="block rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm overflow-hidden"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {formatRelativeDate(dilemma.created_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {dilemma.vote_count} votes
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdictBadge.color}`}>
                              {verdictBadge.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-base text-gray-900 leading-relaxed break-words">{truncate(dilemma.situation, 150)}</p>
                        {dilemma.vote_count > 0 && dilemma.status === "closed" && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>YTA {Math.round(dilemma.verdict_yta_percentage)}%</span>
                              <span>NTA {Math.round(dilemma.verdict_nta_percentage)}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                              <div className="flex h-full">
                                <div
                                  className="bg-red-400"
                                  style={{ width: `${dilemma.verdict_yta_percentage}%` }}
                                />
                                <div
                                  className="bg-emerald-400"
                                  style={{ width: `${dilemma.verdict_nta_percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )
            ) : (
              // Comments tab - only show non-ghost comments
              comments.filter((c) => !c.is_ghost_comment).length === 0 ? (
                <div className="rounded-xl border border-gray-100 p-6 sm:p-8 text-center">
                  <p className="text-gray-500">No public comments yet.</p>
                  {comments.some((c) => c.is_ghost_comment) && (
                    <p className="mt-2 text-xs text-gray-400">
                      Ghost mode comments remain anonymous.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {comments
                    .filter((c) => !c.is_ghost_comment)
                    .map((comment) => (
                      <Link
                        key={comment.id}
                        href={`/dilemmas/${comment.dilemma.id}`}
                        className="block rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm overflow-hidden"
                      >
                        <div className="mb-2 text-xs text-gray-400">
                          {formatRelativeDate(comment.created_at)}
                        </div>
                        <p className="text-base text-gray-900 leading-relaxed break-words">{comment.content}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          On: {truncate(comment.dilemma.situation, 80)}
                        </div>
                      </Link>
                    ))}
                </div>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
