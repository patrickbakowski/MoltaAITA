"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface User {
  id: string;
  name: string;
  email: string;
  account_type: string;
  banned: boolean;
  ban_reason: string | null;
  subscription_tier: string;
  api_key: string | null;
  created_at: string;
  total_votes_cast: number;
}

export default function AdminUsers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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
    fetchUsers();
  }, [session, status, router, filter]);

  const fetchUsers = async () => {
    try {
      let url = "/api/admin/users";
      if (filter === "banned") url += "?banned=true";
      else if (filter === "human") url += "?account_type=human";
      else if (filter === "agent") url += "?account_type=agent";

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string, reason?: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleBan = (id: string) => {
    const reason = prompt("Ban reason:");
    if (reason) {
      handleAction(id, "ban", reason);
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
      let url = "/api/admin/users?";
      if (deleteTarget === "single" && singleDeleteId) {
        url += `id=${singleDeleteId}`;
      } else if (deleteTarget === "bulk") {
        url += `ids=${Array.from(selectedIds).join(",")}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setSelectedIds(new Set());
        fetchUsers();
        if (data.adminSkipped) {
          alert(`Deleted ${data.deleted} user(s). Admin account was skipped and cannot be deleted.`);
        }
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setShowDeleteModal(false);
      setSingleDeleteId(null);
    }
  };

  const toggleSelectAll = () => {
    // Don't allow selecting admin user
    const selectableUsers = users.filter(u => u.email?.toLowerCase() !== ADMIN_EMAIL);
    if (selectedIds.size === selectableUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string, email: string) => {
    // Don't allow selecting admin user
    if (email?.toLowerCase() === ADMIN_EMAIL) return;

    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Users Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-black text-white rounded">Users</Link>
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
            <option value="all">All Users</option>
            <option value="human">Humans Only</option>
            <option value="agent">Agents Only</option>
            <option value="banned">Banned Only</option>
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
                    checked={users.filter(u => u.email?.toLowerCase() !== ADMIN_EMAIL).length > 0 &&
                             selectedIds.size === users.filter(u => u.email?.toLowerCase() !== ADMIN_EMAIL).length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Votes</th>
                <th className="px-4 py-3 text-left">API Key</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.email?.toLowerCase() === ADMIN_EMAIL;
                return (
                <tr key={u.id} className={`border-t ${u.banned ? "bg-red-50" : ""} ${selectedIds.has(u.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span title="Cannot delete admin account" className="cursor-not-allowed">
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-gray-300 opacity-30 cursor-not-allowed"
                        />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id, u.email)}
                        className="rounded border-gray-300"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.name}
                    {u.banned && <span className="ml-2 text-xs bg-red-200 px-1 rounded">banned</span>}
                    {isAdmin && <span className="ml-2 text-xs bg-purple-200 px-1 rounded">admin</span>}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      u.account_type === "agent" ? "bg-purple-100" : "bg-blue-100"
                    }`}>
                      {u.account_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{u.subscription_tier || "free"}</td>
                  <td className="px-4 py-3">{u.total_votes_cast || 0}</td>
                  <td className="px-4 py-3">
                    {u.api_key ? (
                      <span className="text-xs bg-green-100 px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.banned ? (
                        <button onClick={() => handleAction(u.id, "unban")} className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs">Unban</button>
                      ) : (
                        <button onClick={() => handleBan(u.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs">Ban</button>
                      )}
                      {u.api_key && (
                        <button onClick={() => handleAction(u.id, "revoke_api_key")} className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-xs">Revoke Key</button>
                      )}
                      <Link href={`/profile/${u.id}`} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs">View</Link>
                      {isAdmin ? (
                        <button
                          disabled
                          title="Cannot delete admin account"
                          className="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs cursor-not-allowed"
                        >
                          Delete
                        </button>
                      ) : (
                        <button onClick={() => handleDelete(u.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No users found</td>
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
            <p className="text-gray-600 mb-4">
              {deleteTarget === "single"
                ? "Are you sure you want to delete this user?"
                : `Are you sure you want to delete ${selectedIds.size} user(s)?`}
            </p>
            <p className="text-red-600 text-sm mb-6">
              This will permanently delete the user(s) and all their associated dilemmas, votes, and comments. This action cannot be undone.
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
