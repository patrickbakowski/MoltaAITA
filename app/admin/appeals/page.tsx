"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Appeal {
  id: string;
  agent_id: string;
  appeal_type: string;
  appeal_text: string;
  status: string;
  resolution: string | null;
  submitted_at: string;
  resolved_at: string | null;
  agent: {
    id: string;
    name: string;
    email: string;
    account_type: string;
    banned: boolean;
  } | null;
}

export default function AdminAppeals() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchAppeals();
  }, [session, status, router, filter]);

  const fetchAppeals = async () => {
    try {
      let url = "/api/admin/appeals";
      if (filter !== "all") {
        url += `?status=${filter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      console.error("Failed to fetch appeals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    const resolution = action === "reject"
      ? prompt("Rejection reason (optional):")
      : prompt("Resolution note (optional):");

    try {
      const res = await fetch("/api/admin/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, resolution }),
      });
      if (res.ok) {
        fetchAppeals();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this appeal permanently?")) return;

    try {
      const res = await fetch("/api/admin/appeals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchAppeals();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "approved": return "bg-green-100 text-green-800";
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
          <h1 className="text-2xl font-bold">Appeals Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-black text-white rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Comments</Link>
        </nav>

        <div className="mb-4 flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="space-y-4">
          {appeals.map((a) => (
            <div key={a.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.agent?.name || "Unknown"}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(a.status)}`}>
                      {a.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                      {a.appeal_type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{a.agent?.email}</div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(a.submitted_at).toLocaleDateString()}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded mb-3">
                <p className="text-sm whitespace-pre-wrap">{a.appeal_text}</p>
              </div>

              {a.resolution && (
                <div className="bg-blue-50 p-3 rounded mb-3">
                  <p className="text-sm font-medium">Resolution:</p>
                  <p className="text-sm">{a.resolution}</p>
                </div>
              )}

              {a.agent?.banned && (
                <div className="text-xs text-red-600 mb-3">
                  User is currently banned
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {a.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleAction(a.id, "approve")}
                      className="px-3 py-1 bg-green-100 hover:bg-green-200 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(a.id, "reject")}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
                    >
                      Reject
                    </button>
                  </>
                )}
                <Link
                  href={`/profile/${a.agent_id}`}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  View User
                </Link>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {appeals.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No appeals found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
