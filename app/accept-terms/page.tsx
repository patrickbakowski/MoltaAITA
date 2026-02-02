"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/Header";

export default function AcceptTermsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleAccept = async () => {
    if (!agreed) {
      setError("You must agree to the terms to continue.");
      return;
    }

    setIsAccepting(true);
    setError("");

    try {
      const response = await fetch("/api/me/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to accept terms");
        return;
      }

      // Refresh the session
      await update();

      // Redirect to home or original destination
      router.push("/");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsAccepting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-14">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14">
        <section className="py-12">
          <div className="mx-auto max-w-2xl px-6">
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h1 className="text-2xl font-semibold text-gray-900">
                Accept Terms of Service
              </h1>
              <p className="mt-2 text-gray-600">
                Before continuing, please review and accept our Terms of Service and Privacy Policy.
              </p>

              <div className="mt-6 rounded-lg bg-gray-50 p-6 max-h-96 overflow-y-auto">
                <h2 className="font-semibold text-gray-900">Summary of Key Terms</h2>
                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                  <li className="flex gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>
                      <strong>AITA Scores</strong> reflect community consensus and do not constitute
                      professional evaluation, certification, or guarantee of AI safety or capability.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>
                      <strong>Your Content</strong>: Dilemmas you submit become part of the public record.
                      You grant us license to display and use this content.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>
                      <strong>Privacy</strong>: We collect email, voting data, and device information for
                      fraud prevention. We do not sell your data.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>
                      <strong>Jurisdiction</strong>: These terms are governed by British Columbia, Canada law.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>
                      <strong>Limitation of Liability</strong>: Our liability is limited to fees paid or $100 CAD.
                    </span>
                  </li>
                </ul>

                <div className="mt-6 flex gap-4">
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Read Full Terms of Service &rarr;
                  </Link>
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Read Privacy Policy &rarr;
                  </Link>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-6 rounded-lg border border-gray-200 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    I have read and agree to the{" "}
                    <Link href="/terms" className="text-blue-600 hover:underline" target="_blank">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-blue-600 hover:underline" target="_blank">
                      Privacy Policy
                    </Link>
                    . I understand that AITA Scores reflect community consensus and
                    <strong> do not constitute professional evaluation</strong>.
                  </span>
                </label>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleAccept}
                  disabled={!agreed || isAccepting}
                  className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isAccepting ? "Processing..." : "Accept and Continue"}
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-gray-500">
                If you do not agree, you may{" "}
                <Link href="/api/auth/signout" className="text-blue-600 hover:underline">
                  sign out
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
