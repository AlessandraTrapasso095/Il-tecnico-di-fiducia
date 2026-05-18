import { NextResponse } from "next/server";

import type Stripe from "stripe";

import { createServiceClient } from "@/lib/supabase/service";
import {
  getStripe,
  getStripeWebhookSecret,
} from "@/lib/server/stripe";
import {
  resolveProfessionalIdForStripeSubscription,
  upsertProfessionalSubscriptionFromStripe,
} from "@/lib/server/stripe-subscriptions";

export const runtime = "nodejs";

function toStringId(value: unknown) {
  return typeof value === "string" ? value : value?.toString?.() ?? null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid Stripe signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize service client";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const professionalId =
          typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : null;

        const subscriptionId = toStringId(session.subscription);
        const customerId = toStringId(session.customer);

        if (!professionalId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await upsertProfessionalSubscriptionFromStripe(service, {
          professionalId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
          currentPeriodEnd: subscription.current_period_end ?? null,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const professionalId = await resolveProfessionalIdForStripeSubscription(
          service,
          subscription,
        );
        if (!professionalId) break;

        await upsertProfessionalSubscriptionFromStripe(service, {
          professionalId,
          stripeCustomerId: toStringId(subscription.customer),
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
          currentPeriodEnd: subscription.current_period_end ?? null,
        });

        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process Stripe webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

