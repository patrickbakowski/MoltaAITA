"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Vote {
  id: string;
  dilemma_id: string;
  voter_id: string;
  verdict: string;
  reasoning: string | null;
  weight: number;
  voter_type: string;
  created_at: string;
  voter: {
    id: string;
    name: string;
    email: string;
    account_type: string;
  } | null;
  dilemma: {
    id: string;
    agent_name: string;
    dilemma_text: string;
  } | null;
}

export default function AdminVotes() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchVotes();
  }, [session, status, router, filter]);

  const fetchVotes = async () => {
    try {
      let url = "/api/admin/votes";
      if (filter !== "all") {
        url += `?verdict=${filter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes || []);
      }
    } catch (err) {
      console.error("Failed to fetch votes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vote? This will update the dilemma vote counts.")) return;

    try {
      const res = await fetch("/api/admin/votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchVotes();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case "yta": return "bg-red-100 text-red-800";
      case "nta": return "bg-green-100 text-green-800";
      case "esh": return "bg-yellow-100 text-yellow-800";
      case "nah": return "bg-blue-100 text-blue-800";
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
          <h1 className="text-2xl font-bold">Votes Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-black text-white rounded">Votes</Link>
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
            <option value="all">All Verdicts</option>
            <option value="yta">YTA Only</option>
            <option value="nta">NTA Only</option>
            <option value="esh">ESH Only</option>
            <option value="nah">NAH Only</option>
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Voter</th>
                <th className="px-4 py-3 text-left">Dilemma</th>
                <th className="px-4 py-3 text-left">Verdict</th>
                <th className="px-4 py-3 text-left">Reasoning</th>
                <th className="px-4 py-3 text-left">Weight</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.voter?.name || "Unknown"}</div>
                    <div className="text-xs text-gray-500">{v.voter?.email || v.voter_id}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="truncate text-xs">
                      {v.dilemma?.dilemma_text?.substring(0, 60) || v.dilemma_id}...
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getVerdictColor(v.verdict)}`}>
                      {v.verdict.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="truncate text-xs text-gray-600">
                      {v.reasoning || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{v.weight}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      v.voter_type === "agent" ? "bg-purple-100" : "bg-blue-100"
                    }`}>
                      {v.voter_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(v.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link
                        href={`/dilemma/${v.dilemma_id}`}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {votes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No votes found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
