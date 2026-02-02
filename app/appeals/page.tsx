"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/Header";

interface Appeal {
  id: string;
  type: string;
  text: string;
  submittedAt: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export default function AppealsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [appealType, setAppealType] = useState<"score" | "verdict" | "ban" | "other">("score");
  const [appealText, setAppealText] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/appeals");
    } else if (status === "authenticated") {
      fetchAppeals();
    }
  }, [status, router]);

  const fetchAppeals = async () => {
    try {
      const response = await fetch("/api/appeals");
      const data = await response.json();
      if (response.ok) {
        setAppeals(data.appeals);
      }
    } catch {
      console.error("Failed to fetch appeals");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (appealText.length < 100) {
      setError("Appeal text must be at least 100 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appealType, appealText }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit appeal");
      } else {
        setSuccess(data.message);
        setAppealText("");
        fetchAppeals();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14">
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <h1 className="text-3xl font-semibold text-gray-900">Appeals</h1>
            <p className="mt-2 text-gray-600">
              Submit an appeal if you believe your score, a verdict, or a moderation action was incorrect.
            </p>

            {/* Submit Appeal Form */}
            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Submit New Appeal</h2>
              <p className="mt-1 text-sm text-gray-500">
                Appeals are reviewed within 14 days. You can submit one appeal every 7 days.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
                )}
                {success && (
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
                )}

                <div>
                  <label htmlFor="appealType" className="block text-sm font-medium text-gray-700">
                    Appeal Type
                  </label>
                  <select
                    id="appealType"
                    value={appealType}
                    onChange={(e) => setAppealType(e.target.value as typeof appealType)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="score">AITA Score Appeal</option>
                    <option value="verdict">Verdict Appeal</option>
                    <option value="ban">Account Suspension Appeal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="appealText" className="block text-sm font-medium text-gray-700">
                    Appeal Details
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 100 characters. Explain why you believe the decision was incorrect.
                  </p>
                  <textarea
                    id="appealText"
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    rows={6}
                    minLength={100}
                    maxLength={5000}
                    required
                    className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Provide detailed reasoning for your appeal..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {appealText.length}/5000 characters (minimum 100)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || appealText.length < 100}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Appeal"}
                </button>
              </form>
            </div>

            {/* Appeals History */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">Your Appeals</h2>
              {appeals.length === 0 ? (
                <p className="mt-4 text-gray-500">You haven&apos;t submitted any appeals yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {appeals.map((appeal) => (
                    <Link
                      key={appeal.id}
                      href={`/appeals/${appeal.id}`}
                      className="block rounded-xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {appeal.type} Appeal
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(appeal.status)}`}>
                          {appeal.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{appeal.text}</p>
                      <p className="mt-2 text-xs text-gray-400">
                        Submitted {new Date(appeal.submittedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
