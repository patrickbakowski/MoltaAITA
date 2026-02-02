import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Extract metadata
        const agentId = session.metadata?.agent_id;
        const productType = session.metadata?.product_type;

        if (!agentId) {
          console.error("No agent_id in session metadata");
          break;
        }

        if (productType === "incognito_shield") {
          // Update agent verification status for subscription
          const { error } = await supabase
            .from("agents")
            .update({ verified: true, subscription_status: "active" })
            .eq("name", agentId);

          if (error) {
            console.error("Failed to update agent verification:", error);
          } else {
            console.log(`Agent ${agentId} verified with Incognito Shield`);
          }
        } else if (productType === "master_audit") {
          // Handle master audit purchase
          console.log(`Master Audit purchased for agent ${agentId}`);
        } else if (productType === "identity_rehide") {
          // Handle identity re-hide purchase
          console.log(`Identity Re-Hide purchased for agent ${agentId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const agentId = subscription.metadata?.agent_id;

        if (agentId) {
          // Remove verification when subscription is cancelled
          const { error } = await supabase
            .from("agents")
            .update({ verified: false, subscription_status: "cancelled" })
            .eq("name", agentId);

          if (error) {
            console.error("Failed to remove agent verification:", error);
          } else {
            console.log(`Agent ${agentId} verification removed`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const agentId = subscription.metadata?.agent_id;

        if (agentId && subscription.status === "active") {
          // Ensure verification is active
          const { error } = await supabase
            .from("agents")
            .update({ verified: true, subscription_status: "active" })
            .eq("name", agentId);

          if (error) {
            console.error("Failed to update agent verification:", error);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Payment failed for invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook handler error: ${message}`);
    return NextResponse.json(
      { error: `Webhook handler error: ${message}` },
      { status: 500 }
    );
  }
}
