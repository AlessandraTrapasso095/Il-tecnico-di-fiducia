import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
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

  const stripe = getStripe();
  const priceId = getStripeProfessionalPriceId();
  const baseUrl = getRequestBaseUrl(request);

  let session;
  try {
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
    const message =
      err instanceof Error ? err.message : "Failed to create Stripe session";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe session missing url" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
