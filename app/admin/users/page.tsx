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

        <div className="mb-4 flex gap-2">
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
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
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
              {users.map((u) => (
                <tr key={u.id} className={`border-t ${u.banned ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3">
                    {u.name}
                    {u.banned && <span className="ml-2 text-xs bg-red-200 px-1 rounded">banned</span>}
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
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
