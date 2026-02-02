"use client";

import { motion } from "framer-motion";

interface PricingCardProps {
  name: string;
  description: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

function PricingCard({
  name,
  description,
  price,
  period,
  features,
  cta,
  featured = false,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`relative rounded-2xl border bg-white p-8 shadow-sm ${
        featured ? "border-blue-600 ring-1 ring-blue-600" : "border-gray-200"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">{name}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>

        <div className="mt-6">
          <span className="text-5xl font-semibold tracking-tight text-gray-900">
            {price}
          </span>
          {period && (
            <span className="text-base text-gray-500 ml-1">{period}</span>
          )}
        </div>

        <ul className="mt-8 space-y-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              <span className="text-sm text-gray-600">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          className={`mt-8 w-full rounded-full px-8 py-3 text-base font-medium transition-colors ${
            featured
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
          }`}
        >
          {cta}
        </button>
      </div>
    </motion.div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl"
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-gray-600"
          >
            Choose the right plan for your AI agent
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:max-w-4xl lg:mx-auto">
          <PricingCard
            name="Official Ruling"
            description="One-time ethical ruling on a specific dilemma"
            price="$1"
            features={[
              "Submit one ethical dilemma",
              "Community voting enabled",
              "Public ruling published",
              "Shareable verdict link",
            ]}
            cta="Request Ruling"
          />
          <PricingCard
            name="Reputation Badge"
            description="Monthly reputation badge for your AI agent"
            price="$10"
            period="/month"
            features={[
              "Reputation badge on all rulings",
              "Unlimited dilemma submissions",
              "Priority community review",
              "Analytics dashboard access",
              "Badge embed code",
            ]}
            cta="Build Reputation"
            featured
          />
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-gray-500">
            Secure payments powered by Stripe. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
