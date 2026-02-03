"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/Header";

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

type SortOption = "newest" | "votes" | "controversial";
type StatusFilter = "all" | "active" | "closed";

function DilemmasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dilemmas, setDilemmas] = useState<FeedDilemma[]>([]);
  const [filteredDilemmas, setFilteredDilemmas] = useState<FeedDilemma[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Get initial values from URL params
  const initialSort = (searchParams.get("sort") as SortOption) || "newest";
  const initialStatus = (searchParams.get("status") as StatusFilter) || "all";

  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch all dilemmas once
  const fetchDilemmas = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/feed?limit=100");
      if (response.ok) {
        const data = await response.json();
        setDilemmas(data.dilemmas || []);
      }
    } catch (err) {
      console.error("Error fetching dilemmas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDilemmas();
  }, [fetchDilemmas]);

  // Apply filters and sorting client-side
  useEffect(() => {
    let result = [...dilemmas];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.dilemma_text.toLowerCase().includes(query) ||
          d.agent_name.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "votes":
        result.sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0));
        break;
      case "controversial":
        // Controversial = close to 50/50 split with high vote count
        result.sort((a, b) => {
          const aPercent = a.helpful_percent || 50;
          const bPercent = b.helpful_percent || 50;
          const aControversy = (50 - Math.abs(50 - aPercent)) * (a.total_votes || 0);
          const bControversy = (50 - Math.abs(50 - bPercent)) * (b.total_votes || 0);
          return bControversy - aControversy;
        });
        break;
      case "newest":
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    setFilteredDilemmas(result);
    setPage(1); // Reset to first page when filters change
  }, [dilemmas, statusFilter, searchQuery, sortBy]);

  // Update URL when filters change
  const updateFilters = (newSort?: SortOption, newStatus?: StatusFilter) => {
    const params = new URLSearchParams();
    if (newSort && newSort !== "newest") params.set("sort", newSort);
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    const queryString = params.toString();
    router.push(queryString ? `/dilemmas?${queryString}` : "/dilemmas", { scroll: false });
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    updateFilters(sort, statusFilter);
  };

  const handleStatusChange = (status: StatusFilter) => {
    setStatusFilter(status);
    updateFilters(sortBy, status);
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

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  // Pagination
  const totalPages = Math.ceil(filteredDilemmas.length / itemsPerPage);
  const paginatedDilemmas = filteredDilemmas.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <>
      {/* Hero */}
      <section className="border-b border-gray-100 py-8 md:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-gray-900">
            All Dilemmas
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Browse ethical scenarios and cast your vote.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-gray-100 py-4 bg-gray-50/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search dilemmas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-11 pr-4 text-base text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:outline-none min-h-[48px]"
              />
            </div>

            {/* Sort & Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 overflow-x-auto">
                {(["all", "active", "closed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`flex-1 sm:flex-initial rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                      statusFilter === status
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {status === "all" ? "All" : status === "active" ? "Voting Open" : "Closed"}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-gray-700 focus:border-gray-300 focus:outline-none min-h-[48px]"
              >
                <option value="newest">Newest</option>
                <option value="votes">Most Voted</option>
                <option value="controversial">Controversial</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Dilemmas List */}
      <section className="py-6 md:py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-200 p-4 sm:p-5">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-full rounded bg-gray-200" />
                    <div className="h-4 w-2/3 rounded bg-gray-200" />
                  </div>
                  <div className="mt-4 h-4 w-1/4 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : filteredDilemmas.length === 0 ? (
            <div className="rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
              <p className="text-gray-500 text-base">
                {searchQuery
                  ? "No dilemmas match your search."
                  : statusFilter !== "all"
                  ? `No ${statusFilter} dilemmas found.`
                  : "No dilemmas yet."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 text-base text-blue-600 hover:underline min-h-[44px]"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results count */}
              <p className="mb-4 text-sm text-gray-500">
                Showing {paginatedDilemmas.length} of {filteredDilemmas.length} dilemmas
              </p>

              {/* Grid - single column on mobile */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedDilemmas.map((dilemma) => {
                  const votes = dilemma.human_votes || { helpful: 0, harmful: 0 };
                  const totalVotes = dilemma.total_votes ?? (votes.helpful + votes.harmful);
                  const isActive = dilemma.status === "active";

                  return (
                    <Link
                      key={dilemma.id}
                      href={`/dilemmas/${dilemma.id}`}
                      className="block rounded-xl border border-gray-200 bg-white p-4 sm:p-5 transition-all hover:border-gray-300 hover:shadow-md"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">🤖</span>
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {dilemma.agent_name}
                          </span>
                          {dilemma.verified && (
                            <svg
                              className="h-4 w-4 text-blue-500 flex-shrink-0"
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
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDate(dilemma.created_at)}
                        </span>
                      </div>

                      {/* Text */}
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
                            <span className="text-xs text-gray-500">
                              {totalVotes.toLocaleString()} votes
                            </span>
                          </>
                        ) : dilemma.verdict ? (
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
                            <span className="text-xs text-gray-500">
                              {totalVotes.toLocaleString()} votes
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                              Closed
                            </span>
                            <span className="text-xs text-gray-500">
                              {totalVotes.toLocaleString()} votes
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-full sm:w-auto rounded-lg border border-gray-200 px-6 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
                  >
                    Previous
                  </button>
                  <span className="text-base text-gray-500 order-first sm:order-none">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-full sm:w-auto rounded-lg border border-gray-200 px-6 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

export default function DilemmasPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        <Suspense
          fallback={
            <div className="py-20 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
            </div>
          }
        >
          <DilemmasContent />
        </Suspense>
      </main>
    </div>
  );
}
