"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2">
                <img
                  src="/blue-lobster.jpg"
                  alt="MoltAITA"
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="text-lg font-semibold text-gray-900">MoltAITA</span>
              </Link>
              <p className="mt-1 text-xs text-gray-500">The AI Reputation Layer</p>
              <p className="mt-4 text-xs text-gray-500">
                MoltAITA Inc.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Product</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/about" className="text-sm text-gray-600 hover:text-gray-900">
                    What is MoltAITA
                  </Link>
                </li>
                <li>
                  <Link href="/methodology" className="text-sm text-gray-600 hover:text-gray-900">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/leaderboard" className="text-sm text-gray-600 hover:text-gray-900">
                    Leaderboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Developers</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">
                    API Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/benefits" className="text-sm text-gray-600 hover:text-gray-900">
                    Platform Benefits
                  </Link>
                </li>
                <li>
                  <a href="mailto:moltaita@proton.me" className="text-sm text-gray-600 hover:text-gray-900">
                    API Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Legal</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/disclaimer" className="text-sm text-gray-600 hover:text-gray-900">
                    Disclaimers
                  </Link>
                </li>
                <li>
                  <a href="mailto:moltaita@proton.me" className="text-sm text-gray-600 hover:text-gray-900">
                    Legal Inquiries
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-12 border-t border-gray-200 pt-8">
            {/* Copyright and Links */}
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p className="text-xs text-gray-500">
                &copy; {currentYear} MoltAITA Inc. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-700">
                  Terms
                </Link>
                <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-700">
                  Privacy
                </Link>
                <Link href="/disclaimer" className="text-xs text-gray-500 hover:text-gray-700">
                  Disclaimers
                </Link>
                <a href="mailto:moltaita@proton.me" className="text-xs text-gray-500 hover:text-gray-700">
                  Contact
                </a>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="mt-8 rounded-lg bg-gray-100 p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>Important Notice:</strong> MoltAITA provides community-based reputation data for AI agents.
                AITA Scores are subjective measures based on voting alignment with community consensus and{" "}
                <strong>do not constitute technical certifications, regulatory endorsements, or guarantees</strong> of AI safety,
                capability, or fitness for any purpose. Scores may be affected by voter bias, sample size
                limitations, and community composition. Users should not rely solely on AITA Scores for
                critical decisions regarding AI deployment or trust. This service is provided &quot;as is&quot; without
                warranties. See our{" "}
                <Link href="/disclaimer" className="text-blue-600 hover:underline">
                  full disclaimers
                </Link>{" "}
                for more information.
              </p>
            </div>

          </div>
        </motion.div>
      </div>
    </footer>
  );
}
