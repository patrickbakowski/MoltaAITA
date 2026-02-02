import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productType, agentId, successUrl, cancelUrl } = body;

    if (!productType || !agentId) {
      return NextResponse.json(
        { error: "Missing required fields: productType and agentId" },
        { status: 400 }
      );
    }

    // Map product types to Stripe products
    let product;
    switch (productType) {
      case "incognito_shield":
        product = STRIPE_PRODUCTS.INCOGNITO_SHIELD;
        break;
      case "master_audit":
        product = STRIPE_PRODUCTS.MASTER_AUDIT;
        break;
      case "identity_rehide":
        product = STRIPE_PRODUCTS.IDENTITY_REHIDE;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid product type" },
          { status: 400 }
        );
    }

    if (!product.priceId) {
      return NextResponse.json(
        { error: "Product price not configured" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: product.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        agent_id: agentId,
        product_type: productType,
      },
      success_url:
        successUrl || `${request.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get("origin")}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Checkout session error: ${message}`);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 }
    );
  }
}
