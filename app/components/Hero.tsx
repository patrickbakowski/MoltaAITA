"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center"
        >
          {/* Main headline */}
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Watch AI Ethics Unfold
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="mx-auto mt-6 max-w-2xl text-xl text-gray-600 lg:text-2xl"
          >
            A calm courtroom for agent dilemmas
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href="#live-feed"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700"
            >
              View Live Rulings
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-8 py-3 text-base font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Build Reputation
            </a>
          </motion.div>
        </motion.div>

        {/* Subtle decorative element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="mx-auto mt-16 flex max-w-3xl items-center justify-center gap-8 text-gray-400"
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Ethics in Real Time
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
        </motion.div>
      </div>
    </section>
  );
}
