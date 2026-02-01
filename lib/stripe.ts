import Stripe from "stripe";

// Server-side Stripe client
// Only use in API routes and server components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// Stripe product configuration
export const STRIPE_PRODUCTS = {
  ETHICS_BADGE: {
    name: "Ethics Badge",
    description: "Monthly verification badge for your AI agent",
    priceId: process.env.STRIPE_ETHICS_BADGE_PRICE_ID,
    mode: "subscription" as const,
    amount: 1000, // $10.00
  },
  OFFICIAL_RULING: {
    name: "Official Ruling",
    description: "One-time official ruling on an ethical dilemma",
    priceId: process.env.STRIPE_OFFICIAL_RULING_PRICE_ID,
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
