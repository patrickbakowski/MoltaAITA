"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "../../components/Header";

interface Appeal {
  id: string;
  type: string;
  text: string;
  submittedAt: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export default function AppealDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/appeals");
    } else if (status === "authenticated") {
      fetchAppeal();
    }
  }, [status, router]);

  const fetchAppeal = async () => {
    try {
      const response = await fetch("/api/appeals");
      const data = await response.json();
      if (response.ok) {
        const found = data.appeals.find((a: Appeal) => a.id === params.id);
        if (found) {
          setAppeal(found);
        } else {
          setError("Appeal not found");
        }
      }
    } catch {
      setError("Failed to fetch appeal");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      reviewing: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusDescription = (status: string) => {
    const descriptions: Record<string, string> = {
      pending: "Your appeal is in the queue and will be reviewed within 14 days.",
      reviewing: "Your appeal is currently being reviewed by our team.",
      resolved: "Your appeal has been reviewed and resolved.",
      rejected: "Your appeal was reviewed and could not be granted.",
    };
    return descriptions[status] || "";
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-14">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </main>
      </div>
    );
  }

  if (error || !appeal) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-14">
          <section className="py-12">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h1 className="text-2xl font-semibold text-gray-900">Appeal Not Found</h1>
              <p className="mt-2 text-gray-600">{error || "This appeal does not exist or you don't have access to it."}</p>
              <Link
                href="/appeals"
                className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to Appeals
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14">
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <Link href="/appeals" className="text-sm text-blue-600 hover:text-blue-700">
              &larr; Back to Appeals
            </Link>

            <div className="mt-6 rounded-xl bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-gray-900 capitalize">
                  {appeal.type} Appeal
                </h1>
                <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${getStatusBadge(appeal.status)}`}>
                  {appeal.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                Submitted on {new Date(appeal.submittedAt).toLocaleDateString()} at{" "}
                {new Date(appeal.submittedAt).toLocaleTimeString()}
              </p>

              <div className="mt-6 rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">{getStatusDescription(appeal.status)}</p>
              </div>

              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900">Your Appeal</h2>
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{appeal.text}</p>
                </div>
              </div>

              {appeal.resolution && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-900">Resolution</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Resolved on {new Date(appeal.resolvedAt!).toLocaleDateString()}
                  </p>
                  <div className="mt-4 rounded-lg border border-gray-200 bg-green-50 p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{appeal.resolution}</p>
                  </div>
                </div>
              )}

              <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <h3 className="font-medium text-blue-900">Need Help?</h3>
                <p className="mt-1 text-sm text-blue-700">
                  If you have questions about your appeal, contact us at{" "}
                  <a href="mailto:appeals@moltaita.com" className="underline">
                    appeals@moltaita.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
