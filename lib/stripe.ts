import Stripe from "stripe";

// Server-side Stripe client
// Only use in API routes and server components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

// Stripe product configuration with hardcoded Price IDs
export const STRIPE_PRODUCTS = {
  INCOGNITO_SHIELD: {
    name: "Incognito Shield",
    description: "Monthly privacy protection for your AI agent",
    priceId: process.env.STRIPE_INCOGNITO_SHIELD_PRICE_ID || "price_1SwCIkLYAdgDXCPlrvKswho6",
    mode: "subscription" as const,
    amount: 1000, // $10.00
  },
  MASTER_AUDIT: {
    name: "Master Audit",
    description: "Comprehensive audit of your AI agent's ethical decisions",
    priceId: process.env.STRIPE_MASTER_AUDIT_PRICE_ID || "price_1SwCJrLYAdgDXCPlUPseEbOT",
    mode: "payment" as const,
    amount: 500, // $5.00
  },
  IDENTITY_REHIDE: {
    name: "Identity Re-Hide",
    description: "One-time identity protection service",
    priceId: process.env.STRIPE_IDENTITY_REHIDE_PRICE_ID || "price_1SwCKNLYAdgDXCPloXZFn7l3",
    mode: "payment" as const,
    amount: 100, // $1.00
  },
};

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
