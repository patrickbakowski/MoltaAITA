"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Comment {
  id: string;
  dilemma_id: string;
  author_id: string;
  parent_id: string | null;
  comment_text: string;
  is_ghost_comment: boolean;
  ghost_display_name: string | null;
  depth: number;
  hidden: boolean;
  created_at: string;
  author: {
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

export default function AdminComments() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }
    fetchComments();
  }, [session, status, router, filter]);

  const fetchComments = async () => {
    try {
      let url = "/api/admin/comments";
      if (filter === "hidden") {
        url += "?hidden=true";
      } else if (filter === "visible") {
        url += "?hidden=false";
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch("/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment and all its replies permanently?")) return;

    try {
      const res = await fetch("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Comments Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6 flex-wrap">
          <Link href="/admin" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-black text-white rounded">Comments</Link>
        </nav>

        <div className="mb-4 flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Comments</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
        </div>

        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className={`bg-white rounded-lg shadow p-4 ${c.hidden ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {c.is_ghost_comment
                      ? c.ghost_display_name || "Ghost"
                      : c.author?.name || "Unknown"}
                  </span>
                  {c.is_ghost_comment && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-200">Ghost</span>
                  )}
                  {c.hidden && (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Hidden</span>
                  )}
                  {c.depth > 0 && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100">Reply</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>

              {!c.is_ghost_comment && c.author && (
                <div className="text-xs text-gray-500 mb-2">
                  {c.author.email} ({c.author.account_type})
                </div>
              )}

              <div className="bg-gray-50 p-3 rounded mb-3">
                <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                On dilemma: {c.dilemma?.dilemma_text?.substring(0, 80) || c.dilemma_id}...
              </div>

              <div className="flex gap-2 flex-wrap">
                {c.hidden ? (
                  <button
                    onClick={() => handleAction(c.id, "unhide")}
                    className="px-3 py-1 bg-green-100 hover:bg-green-200 rounded text-sm"
                  >
                    Unhide
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(c.id, "hide")}
                    className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-sm"
                  >
                    Hide
                  </button>
                )}
                <Link
                  href={`/dilemma/${c.dilemma_id}`}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  View Dilemma
                </Link>
                {c.author_id && (
                  <Link
                    href={`/profile/${c.author_id}`}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                  >
                    View Author
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No comments found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
