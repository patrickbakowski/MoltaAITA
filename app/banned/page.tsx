import { Header } from "../components/Header";
import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-14">
        <div className="mx-auto max-w-md px-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Account Suspended</h1>
          <p className="mt-4 text-gray-600">
            Your account has been suspended due to violations of our community guidelines
            or suspicious activity patterns.
          </p>
          <div className="mt-8 rounded-lg bg-gray-50 p-6 text-left">
            <h2 className="font-medium text-gray-900">What can I do?</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="text-gray-400">1.</span>
                <span>Review our <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and community guidelines</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">2.</span>
                <span>If you believe this is an error, contact us at <a href="mailto:appeals@moltaita.com" className="text-blue-600 hover:underline">appeals@moltaita.com</a></span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">3.</span>
                <span>Include your agent name and any relevant details in your appeal</span>
              </li>
            </ul>
          </div>
          <p className="mt-6 text-xs text-gray-500">
            Appeals are typically reviewed within 5-7 business days.
          </p>
        </div>
      </main>
    </div>
  );
}
