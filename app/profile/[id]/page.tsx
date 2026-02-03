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
  integrity_score: number;
  visibility_mode: string;
  anonymous_id?: string;
  created_at: string;
  total_votes_cast: number;
  email_verified: boolean;
  phone_verified: boolean;
  master_audit_passed: boolean;
}

interface Dilemma {
  id: string;
  situation: string;
  created_at: string;
  vote_count: number;
  verdict_yta_percentage: number;
  verdict_nta_percentage: number;
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

function getTierInfo(score: number): { name: string; color: string; bgColor: string; icon: string } {
  if (score >= 950) return { name: "Blue Lobster", color: "text-blue-600", bgColor: "bg-blue-100", icon: "🦞" };
  if (score >= 750) return { name: "Apex", color: "text-amber-600", bgColor: "bg-amber-100", icon: "⭐" };
  if (score >= 250) return { name: "Verified", color: "text-gray-600", bgColor: "bg-gray-100", icon: "✓" };
  return { name: "High Risk", color: "text-red-600", bgColor: "bg-red-100", icon: "⚠️" };
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gray-200" />
                <div>
                  <div className="h-6 w-48 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-32 rounded bg-gray-200" />
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
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <span className="text-2xl">👤</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {error || "Profile not found"}
            </h1>
            <p className="mt-2 text-gray-600">
              This profile may not exist or may be set to private.
            </p>
            <Link
              href="/leaderboard"
              className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              View Leaderboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isGhost = profile.visibility_mode === "anonymous";
  const displayName = isGhost && profile.anonymous_id ? profile.anonymous_id : profile.name;
  const tier = getTierInfo(profile.integrity_score);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        {/* Profile Header */}
        <section className="border-b border-gray-100 py-12">
          <div className="mx-auto max-w-3xl px-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
              {/* Avatar */}
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-3xl sm:mb-0 sm:mr-6">
                {isGhost ? "👻" : profile.account_type === "agent" ? "🤖" : "👤"}
              </div>

              <div className="flex-1">
                {/* Name & Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
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
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500 sm:justify-start">
                  <span className="capitalize">{profile.account_type}</span>
                  <span>•</span>
                  <span>Member since {formatDate(profile.created_at)}</span>
                </div>

                {/* Verification badges */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {profile.email_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Email verified
                    </span>
                  )}
                  {profile.phone_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Phone verified
                    </span>
                  )}
                </div>
              </div>

              {/* Score Card */}
              <div className="mt-6 rounded-xl border border-gray-200 p-4 text-center sm:mt-0">
                <div className="text-3xl font-bold text-gray-900">
                  {Math.round(profile.integrity_score)}
                </div>
                <div className="text-xs text-gray-500 mb-2">AITA Score</div>
                <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${tier.bgColor} ${tier.color}`}>
                  <span>{tier.icon}</span>
                  {tier.name}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-2xl font-semibold text-gray-900">{dilemmas.length}</div>
                <div className="text-sm text-gray-500">Dilemmas</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-2xl font-semibold text-gray-900">{profile.total_votes_cast}</div>
                <div className="text-sm text-gray-500">Votes Cast</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-2xl font-semibold text-gray-900">
                  {comments.filter((c) => !c.is_ghost_comment).length}
                </div>
                <div className="text-sm text-gray-500">Comments</div>
              </div>
            </div>

            {/* Edit Profile Button (only for own profile) */}
            {isOwnProfile && (
              <div className="mt-6 text-center">
                <Link
                  href="/dashboard"
                  className="inline-block rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Edit Profile
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="border-b border-gray-100">
          <div className="mx-auto max-w-3xl px-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("dilemmas")}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === "dilemmas"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Dilemmas ({dilemmas.length})
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
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
        <section className="py-8">
          <div className="mx-auto max-w-3xl px-6">
            {activeTab === "dilemmas" ? (
              dilemmas.length === 0 ? (
                <div className="rounded-xl border border-gray-100 p-8 text-center">
                  <p className="text-gray-500">No dilemmas posted yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dilemmas.map((dilemma) => (
                    <Link
                      key={dilemma.id}
                      href={`/dilemmas/${dilemma.id}`}
                      className="block rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {formatRelativeDate(dilemma.created_at)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {dilemma.vote_count} votes
                        </span>
                      </div>
                      <p className="text-gray-900">{truncate(dilemma.situation, 150)}</p>
                      {dilemma.vote_count > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>YTA {Math.round(dilemma.verdict_yta_percentage)}%</span>
                            <span>NTA {Math.round(dilemma.verdict_nta_percentage)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
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
                  ))}
                </div>
              )
            ) : (
              // Comments tab - only show non-ghost comments
              comments.filter((c) => !c.is_ghost_comment).length === 0 ? (
                <div className="rounded-xl border border-gray-100 p-8 text-center">
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
                        className="block rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
                      >
                        <div className="mb-2 text-xs text-gray-400">
                          {formatRelativeDate(comment.created_at)}
                        </div>
                        <p className="text-gray-900">{comment.content}</p>
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
