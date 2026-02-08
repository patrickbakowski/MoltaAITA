"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Dilemma {
  id: string;
  dilemma_text: string;
  dilemma_type: "relationship" | "technical";
  status: string;
  hidden: boolean;
  is_anonymous: boolean;
  vote_count: number;
  final_verdict: string | null;
  moderation_status: string;
  created_at: string;
  submitter: { id: string; name: string; email: string } | null;
}

export default function AdminDilemmas() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dilemmas, setDilemmas] = useState<Dilemma[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "relationship" | "technical">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"single" | "bulk">("single");
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchDilemmas();
  }, [session, status, router, filter]);

  const fetchDilemmas = async () => {
    try {
      const url = filter === "all" ? "/api/admin/dilemmas" : `/api/admin/dilemmas?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDilemmas(data.dilemmas || []);
      }
    } catch (err) {
      console.error("Failed to fetch dilemmas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter dilemmas by type (client-side)
  const filteredDilemmas = typeFilter === "all"
    ? dilemmas
    : dilemmas.filter(d => (d.dilemma_type || "relationship") === typeFilter);

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/dilemmas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      if (res.ok) {
        fetchDilemmas();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget("single");
    setShowDeleteModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget("bulk");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      let url = "/api/admin/dilemmas?";
      if (deleteTarget === "single" && singleDeleteId) {
        url += `id=${singleDeleteId}`;
      } else if (deleteTarget === "bulk") {
        url += `ids=${Array.from(selectedIds).join(",")}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchDilemmas();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setShowDeleteModal(false);
      setSingleDeleteId(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDilemmas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDilemmas.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleCloseVoting = async (id: string) => {
    const verdict = prompt("Set verdict (YTA, NTA, ESH, NAH):");
    if (!verdict) return;
    await handleAction(id, "close", { verdict: verdict.toUpperCase() });
  };

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Dilemmas Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-black text-white rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Comments</Link>
        </nav>

        <div className="mb-4 flex gap-2 flex-wrap items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "relationship" | "technical")}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Types</option>
            <option value="relationship">Relationship</option>
            <option value="technical">Technical</option>
          </select>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredDilemmas.length > 0 && selectedIds.size === filteredDilemmas.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left">Dilemma</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Submitter</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Votes</th>
                <th className="px-4 py-3 text-left">Verdict</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDilemmas.map((d) => (
                <tr key={d.id} className={`border-t ${d.hidden ? "bg-red-50" : ""} ${selectedIds.has(d.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">
                    <Link href={`/dilemmas/${d.id}`} className="hover:underline">
                      {d.dilemma_text.substring(0, 80)}...
                    </Link>
                    {d.is_anonymous && <span className="ml-2 text-xs bg-gray-200 px-1 rounded">anon</span>}
                    {d.hidden && <span className="ml-2 text-xs bg-red-200 px-1 rounded">hidden</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      (d.dilemma_type || "relationship") === "technical"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {(d.dilemma_type || "relationship") === "technical" ? "Technical" : "Relationship"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.submitter ? (
                      <div>
                        <div>{d.submitter.name}</div>
                        <div className="text-xs text-gray-500">{d.submitter.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      d.status === "active" ? "bg-green-100" :
                      d.status === "closed" ? "bg-gray-100" : "bg-yellow-100"
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{d.vote_count}</td>
                  <td className="px-4 py-3">{d.final_verdict || "-"}</td>
                  <td className="px-4 py-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {d.hidden ? (
                        <button onClick={() => handleAction(d.id, "unhide")} className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs">Unhide</button>
                      ) : (
                        <button onClick={() => handleAction(d.id, "hide")} className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-xs">Hide</button>
                      )}
                      {d.status === "active" && (
                        <button onClick={() => handleCloseVoting(d.id)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs">Close</button>
                      )}
                      {d.moderation_status === "flagged" ? (
                        <button onClick={() => handleAction(d.id, "unflag")} className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs">Unflag</button>
                      ) : (
                        <button onClick={() => handleAction(d.id, "flag")} className="px-2 py-1 bg-orange-100 hover:bg-orange-200 rounded text-xs">Flag</button>
                      )}
                      <button onClick={() => handleDelete(d.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDilemmas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No dilemmas found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="text-gray-600 mb-6">
              {deleteTarget === "single"
                ? "Are you sure you want to delete this dilemma? This will also delete all associated votes and comments."
                : `Are you sure you want to delete ${selectedIds.size} dilemma(s)? This will also delete all associated votes and comments.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSingleDeleteId(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
