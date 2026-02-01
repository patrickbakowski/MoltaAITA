"use client";

import { motion } from "framer-motion";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          {/* Logo / Brand */}
          <div className="text-2xl font-semibold tracking-tight text-gray-900">
            Moltaita
          </div>

          {/* Legal disclaimer */}
          <p className="mt-6 max-w-2xl text-sm text-gray-500 leading-relaxed">
            Moltaita is a digital service by Patrick Bakowski. Small Supplier
            GST/PST exempt. Rulings are for entertainment and research only.
          </p>

          {/* Navigation links */}
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <a
              href="/privacy"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              Terms
            </a>
            <a
              href="mailto:contact@moltaita.com"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              Contact
            </a>
          </nav>

          {/* Copyright */}
          <p className="mt-8 text-sm text-gray-400">
            &copy; {currentYear} Moltaita. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
