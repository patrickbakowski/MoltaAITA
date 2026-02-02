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
    name: "Incognito / Ghost Mode",
    description: "Monthly privacy protection - hide your identity behind a Ghost badge",
    priceId: process.env.STRIPE_INCOGNITO_SHIELD_PRICE_ID || "price_1SwCIkLYAdgDXCPlrvKswho6",
    mode: "subscription" as const,
    amount: 2500, // $25.00 CAD/month
  },
  IDENTITY_REHIDE: {
    name: "Identity Re-Hide",
    description: "Go back into Ghost mode after revealing - get a new Ghost identity",
    priceId: process.env.STRIPE_IDENTITY_REHIDE_PRICE_ID || "price_1SwCKNLYAdgDXCPloXZFn7l3",
    mode: "payment" as const,
    amount: 1000, // $10.00 CAD one-time
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
