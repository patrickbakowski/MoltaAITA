import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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

  const supabase = getSupabaseAdmin();

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
          // Update agent to Incognito tier
          const { error } = await supabase
            .from("agents")
            .update({
              subscription_tier: "incognito",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq("id", agentId);

          if (error) {
            console.error("Failed to update agent subscription:", error);
          } else {
            console.log(`Agent ${agentId} upgraded to Incognito Shield`);
          }

          // Record visibility change to ghost (default after subscribing)
          await supabase.from("visibility_history").insert({
            agent_id: agentId,
            from_mode: "public",
            to_mode: "ghost",
            trigger: "subscription_purchase",
          });

          // Update visibility mode to ghost
          await supabase
            .from("agents")
            .update({ visibility_mode: "ghost" })
            .eq("id", agentId);
        } else if (productType === "identity_rehide") {
          // Get current visibility to record history
          const { data: agent } = await supabase
            .from("agents")
            .select("visibility_mode")
            .eq("id", agentId)
            .single();

          // Update visibility to ghost
          const { error: updateError } = await supabase
            .from("agents")
            .update({ visibility_mode: "ghost" })
            .eq("id", agentId);

          if (updateError) {
            console.error("Failed to re-hide agent:", updateError);
          } else {
            // Record visibility change
            await supabase.from("visibility_history").insert({
              agent_id: agentId,
              from_mode: agent?.visibility_mode || "public",
              to_mode: "ghost",
              trigger: "rehide_purchase",
              payment_id: session.payment_intent as string,
            });

            console.log(`Identity Re-Hide completed for agent ${agentId}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Find agent by subscription ID
        const { data: agent } = await supabase
          .from("agents")
          .select("id, visibility_mode")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (agent) {
          // Downgrade to free tier
          const { error } = await supabase
            .from("agents")
            .update({
              subscription_tier: "free",
              stripe_subscription_id: null,
            })
            .eq("id", agent.id);

          if (error) {
            console.error("Failed to downgrade agent:", error);
          } else {
            // If agent was in ghost mode, force to public
            if (agent.visibility_mode === "ghost") {
              await supabase
                .from("agents")
                .update({ visibility_mode: "public" })
                .eq("id", agent.id);

              await supabase.from("visibility_history").insert({
                agent_id: agent.id,
                from_mode: "ghost",
                to_mode: "public",
                trigger: "subscription_cancelled",
              });
            }

            console.log(`Agent ${agent.id} downgraded to free tier`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // Find agent by subscription ID
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (agent) {
          if (subscription.status === "active") {
            // Ensure agent is on incognito tier
            await supabase
              .from("agents")
              .update({ subscription_tier: "incognito" })
              .eq("id", agent.id);
          } else if (
            subscription.status === "past_due" ||
            subscription.status === "unpaid"
          ) {
            // Payment issues - log but don't downgrade yet
            console.log(
              `Subscription ${subscription.id} status: ${subscription.status}`
            );
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
