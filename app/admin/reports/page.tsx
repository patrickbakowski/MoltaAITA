"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Report {
  id: string;
  reporter_id: string;
  content_type: "dilemma" | "comment";
  content_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  status: "pending" | "reviewed" | "dismissed";
  reviewed_at: string | null;
  reporter: {
    id: string;
    name: string;
    email: string;
  } | null;
  content: {
    id: string;
    agent_name?: string;
    dilemma_text?: string;
    comment_text?: string;
    status?: string;
    dilemma_id?: string;
  } | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  personal_info: "Personal Information",
  misleading: "Misleading/Fake",
  other: "Other",
};

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }

    fetchReports();
  }, [session, status, router, filter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/admin/reports" : `/api/admin/reports?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reportId: string, newStatus: string, action?: string) => {
    setActionLoading(reportId);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status: newStatus, action }),
      });

      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Delete this report?")) return;

    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports?id=${reportId}`, { method: "DELETE" });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return <div className="p-8">Access denied</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 text-sm">Logged in as {session.user.email}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation */}
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Comments</Link>
          <Link href="/admin/reports" className="px-4 py-2 bg-black text-white rounded">Reports</Link>
        </nav>

        {/* Filter */}
        <div className="mb-4 flex gap-2">
          {(["all", "pending", "reviewed", "dismissed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded ${
                filter === f ? "bg-black text-white" : "bg-white hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Reports List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {filter !== "all" ? filter : ""} reports found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {reports.map((report) => (
                <div key={report.id} className="p-4">
                  {/* Report Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      report.content_type === "dilemma" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {report.content_type}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      report.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      report.status === "reviewed" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {report.status}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {REASON_LABELS[report.reason] || report.reason}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(report.created_at)}
                    </span>
                  </div>

                  {/* Reporter Info */}
                  <div className="text-sm text-gray-600 mb-2">
                    Reported by:{" "}
                    {report.reporter ? (
                      <Link href={`/admin/users`} className="text-blue-600 hover:underline">
                        {report.reporter.name || report.reporter.email}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                  </div>

                  {/* Report Details */}
                  {report.details && (
                    <div className="bg-gray-50 rounded p-3 mb-3 text-sm">
                      <strong>Details:</strong> {report.details}
                    </div>
                  )}

                  {/* Content Preview */}
                  {report.content && (
                    <div className="bg-gray-50 rounded p-3 mb-3">
                      <div className="text-xs text-gray-500 mb-1">Reported Content:</div>
                      <p className="text-sm text-gray-800 line-clamp-3">
                        {report.content.dilemma_text || report.content.comment_text || "Content not found"}
                      </p>
                      {report.content_type === "dilemma" && report.content.id && (
                        <Link
                          href={`/dilemmas/${report.content.id}`}
                          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                          target="_blank"
                        >
                          View dilemma
                        </Link>
                      )}
                      {report.content_type === "comment" && report.content.dilemma_id && (
                        <Link
                          href={`/dilemmas/${report.content.dilemma_id}`}
                          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                          target="_blank"
                        >
                          View dilemma
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {report.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleAction(report.id, "dismissed")}
                          disabled={actionLoading === report.id}
                          className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleAction(report.id, "reviewed")}
                          disabled={actionLoading === report.id}
                          className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50"
                        >
                          Mark Reviewed
                        </button>
                        <button
                          onClick={() => handleAction(report.id, "reviewed", "hide_content")}
                          disabled={actionLoading === report.id}
                          className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded disabled:opacity-50"
                        >
                          Hide Content
                        </button>
                        {report.content_type === "comment" && (
                          <button
                            onClick={() => handleAction(report.id, "reviewed", "delete_content")}
                            disabled={actionLoading === report.id}
                            className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-50"
                          >
                            Delete Comment
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(report.id)}
                      disabled={actionLoading === report.id}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      Delete Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
