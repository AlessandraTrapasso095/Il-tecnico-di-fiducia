import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { logApiError } from "@/lib/server/api-logger";
import { getStripe, getStripeProfessionalPriceId } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let stripeCustomerId: string | null = null;
  const { data: existing } = await supabase
    .from("professional_subscriptions")
    .select("stripe_customer_id")
    .eq("professional_id", user.id)
    .maybeSingle();

  if (existing?.stripe_customer_id) stripeCustomerId = existing.stripe_customer_id;

  const baseUrl = getRequestBaseUrl(request);

  let session;
  try {
    const stripe = getStripe();
    const priceId = getStripeProfessionalPriceId();

    session = await stripe.checkout.sessions.create({
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
  } catch (err) {
    logApiError("BILLING_CHECKOUT ERROR", {
      query: "stripe checkout session create",
      user_id: user.id,
      has_stripe_customer: Boolean(stripeCustomerId),
      base_url: baseUrl,
      error: err,
    });

    const isMissingStripeEnv =
      err instanceof Error && err.message.startsWith("Missing env: STRIPE_");
    return NextResponse.json(
      {
        error: isMissingStripeEnv
          ? "Pagamenti temporaneamente non configurati. Riprova più tardi."
          : "Non è stato possibile avviare il pagamento. Riprova.",
      },
      { status: isMissingStripeEnv ? 503 : 500 },
    );
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe session missing url" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
