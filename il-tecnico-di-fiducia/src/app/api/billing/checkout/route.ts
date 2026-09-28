import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { logApiError } from "@/lib/server/api-logger";
import {
  getStripe,
  getStripeProfessionalPriceId,
  type ProfessionalSubscriptionPlan,
} from "@/lib/server/stripe";

const EXISTING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: { plan?: unknown };
  try {
    payload = (await request.json()) as { plan?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Richiesta di abbonamento non valida." },
      { status: 400 },
    );
  }

  if (payload.plan !== "monthly" && payload.plan !== "annual") {
    return NextResponse.json(
      { error: "Piano di abbonamento non valido." },
      { status: 400 },
    );
  }

  const plan: ProfessionalSubscriptionPlan = payload.plan;

  const { data: existing, error: existingError } = await supabase
    .from("professional_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("professional_id", user.id)
    .maybeSingle();

  if (existingError) {
    logApiError("BILLING_CHECKOUT SUBSCRIPTION LOAD ERROR", {
      query: "professional_subscriptions",
      user_id: user.id,
      error: existingError,
    });

    return NextResponse.json(
      { error: "Impossibile verificare l’abbonamento. Riprova." },
      { status: 500 },
    );
  }

  const stripeCustomerId = existing?.stripe_customer_id ?? null;
  const stripeSubscriptionId = existing?.stripe_subscription_id ?? null;
  const baseUrl = getRequestBaseUrl(request);

  try {
    const stripe = getStripe();
    const priceId = getStripeProfessionalPriceId(plan);

    if (stripeSubscriptionId) {
      const stripeSubscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      if (EXISTING_SUBSCRIPTION_STATUSES.has(stripeSubscription.status)) {
        if (!stripeCustomerId) {
          logApiError("BILLING_CHECKOUT STRIPE CUSTOMER MISSING", {
            query: "existing Stripe subscription",
            user_id: user.id,
            stripe_subscription_id_present: true,
          });

          return NextResponse.json(
            {
              error:
                "L’abbonamento Stripe esiste già ma non può essere gestito in questo momento. Contatta l’assistenza.",
            },
            { status: 409 },
          );
        }

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${baseUrl}/professionista/abbonamento`,
        });

        return NextResponse.json({ url: portalSession.url });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          professional_id: user.id,
        },
      },
      success_url: `${baseUrl}/professionista/abbonamento?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/professionista/abbonamento?billing=cancel`,
    });

    if (!session.url) {
      throw new Error("Stripe checkout session did not return a URL");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logApiError("BILLING_CHECKOUT ERROR", {
      query: "stripe checkout or existing subscription verification",
      user_id: user.id,
      has_stripe_customer: Boolean(stripeCustomerId),
      has_stripe_subscription: Boolean(stripeSubscriptionId),
      base_url: baseUrl,
      plan,
      error: err,
    });

    const isMissingStripeEnv =
      err instanceof Error && err.message.startsWith("Missing env: STRIPE_");

    return NextResponse.json(
      {
        error: isMissingStripeEnv
          ? "Pagamenti temporaneamente non configurati. Riprova più tardi."
          : "Non è stato possibile avviare o gestire il pagamento. Riprova.",
      },
      { status: isMissingStripeEnv ? 503 : 500 },
    );
  }
}
