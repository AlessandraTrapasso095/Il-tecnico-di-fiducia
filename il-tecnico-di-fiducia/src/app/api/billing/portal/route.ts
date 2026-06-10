import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { getStripe } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { data, error } = await supabase
    .from("professional_subscriptions")
    .select("stripe_customer_id")
    .eq("professional_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load Stripe customer" },
      { status: 500 },
    );
  }

  if (!data?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Stripe customer not available for this subscription" },
      { status: 400 },
    );
  }

  try {
    const baseUrl = getRequestBaseUrl(request);
    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${baseUrl}/professionista/impostazioni/abbonamento`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create Stripe portal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
