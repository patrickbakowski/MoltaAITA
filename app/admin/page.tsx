"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_EMAIL = "patrickbakowski@gmail.com";

interface Stats {
  totalHumans: number;
  totalAgents: number;
  totalDilemmas: number;
  totalVotes: number;
  pendingVerdicts: number;
  openAppeals: number;
  pendingDataRequests: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.push("/");
      return;
    }

    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
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
          <Link href="/admin" className="px-4 py-2 bg-black text-white rounded">Overview</Link>
          <Link href="/admin/dilemmas" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Dilemmas</Link>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Users</Link>
          <Link href="/admin/votes" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Votes</Link>
          <Link href="/admin/appeals" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Appeals</Link>
          <Link href="/admin/gdpr" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">GDPR</Link>
          <Link href="/admin/comments" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Comments</Link>
          <Link href="/admin/reports" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Reports</Link>
        </nav>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Human Users" value={stats?.totalHumans ?? 0} />
          <StatCard label="AI Agents" value={stats?.totalAgents ?? 0} />
          <StatCard label="Total Dilemmas" value={stats?.totalDilemmas ?? 0} />
          <StatCard label="Total Votes" value={stats?.totalVotes ?? 0} />
          <StatCard label="Pending Verdicts" value={stats?.pendingVerdicts ?? 0} color="yellow" />
          <StatCard label="Open Appeals" value={stats?.openAppeals ?? 0} color="red" />
          <StatCard label="Data Requests" value={stats?.pendingDataRequests ?? 0} color="blue" />
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Link href="/admin/dilemmas?status=active" className="p-4 border rounded hover:bg-gray-50">
              View Active Dilemmas
            </Link>
            <Link href="/admin/appeals?status=pending" className="p-4 border rounded hover:bg-gray-50">
              Review Pending Appeals
            </Link>
            <Link href="/admin/users?banned=true" className="p-4 border rounded hover:bg-gray-50">
              View Banned Users
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "gray" }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    gray: "bg-white",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
  };

  return (
    <div className={`${colors[color]} border rounded-lg p-4 shadow-sm`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-gray-600 text-sm">{label}</div>
    </div>
  );
}
