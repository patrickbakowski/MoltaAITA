"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface ExportRequest {
  id: string;
  agent_id: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  request_type: "export";
  agent: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface CorrectionRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  correction_type: string;
  description: string;
  dilemma_id: string | null;
  status: string;
  created_at: string;
  request_type: "correction";
}

type DataRequest = ExportRequest | CorrectionRequest;

export default function AdminGDPR() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchRequests();
  }, [session, status, router, filter, typeFilter]);

  const fetchRequests = async () => {
    try {
      let url = "/api/admin/gdpr";
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (typeFilter === "export") {
          setRequests(data.exports || []);
        } else if (typeFilter === "correction") {
          setRequests(data.corrections || []);
        } else {
          setRequests(data.all || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, type: string, action: string) => {
    try {
      const res = await fetch("/api/admin/gdpr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, action }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm("Delete this request permanently?")) return;

    try {
      const res = await fetch("/api/admin/gdpr", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100";
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">GDPR / Data Requests</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-black text-white rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Comments</Link>
        </nav>

        <div className="mb-4 flex gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Status</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Types</option>
            <option value="export">Export Requests</option>
            <option value="correction">Correction Requests</option>
          </select>
        </div>

        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {r.request_type === "export"
                        ? (r as ExportRequest).agent?.name || "Unknown"
                        : (r as CorrectionRequest).user_name || "Unknown"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(r.status)}`}>
                      {r.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      r.request_type === "export" ? "bg-blue-100" : "bg-purple-100"
                    }`}>
                      {r.request_type === "export" ? "Data Export" : "Data Correction"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {r.request_type === "export"
                      ? (r as ExportRequest).agent?.email
                      : (r as CorrectionRequest).user_email}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(
                    r.request_type === "export"
                      ? (r as ExportRequest).requested_at
                      : (r as CorrectionRequest).created_at
                  ).toLocaleDateString()}
                </div>
              </div>

              {r.request_type === "correction" && (
                <div className="bg-gray-50 p-3 rounded mb-3">
                  <p className="text-sm font-medium mb-1">
                    Type: {(r as CorrectionRequest).correction_type}
                  </p>
                  <p className="text-sm">{(r as CorrectionRequest).description}</p>
                  {(r as CorrectionRequest).dilemma_id && (
                    <Link
                      href={`/dilemma/${(r as CorrectionRequest).dilemma_id}`}
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                    >
                      View Related Dilemma
                    </Link>
                  )}
                </div>
              )}

              {r.request_type === "export" && (r as ExportRequest).completed_at && (
                <div className="text-xs text-gray-500 mb-3">
                  Completed: {new Date((r as ExportRequest).completed_at!).toLocaleDateString()}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleAction(r.id, r.request_type, "complete")}
                      className="px-3 py-1 bg-green-100 hover:bg-green-200 rounded text-sm"
                    >
                      Mark Complete
                    </button>
                    <button
                      onClick={() => handleAction(r.id, r.request_type, "reject")}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
                    >
                      Reject
                    </button>
                  </>
                )}
                {r.request_type === "export" && (r as ExportRequest).agent_id && (
                  <Link
                    href={`/profile/${(r as ExportRequest).agent_id}`}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                  >
                    View User
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(r.id, r.request_type)}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No data requests found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
