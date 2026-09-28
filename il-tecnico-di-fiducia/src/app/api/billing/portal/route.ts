import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { logApiError } from "@/lib/server/api-logger";
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
    logApiError("BILLING_PORTAL SUBSCRIPTION LOAD ERROR", {
      query: "professional_subscriptions",
      user_id: user.id,
      error,
    });

    return NextResponse.json(
      { error: "Impossibile caricare i dati dell’abbonamento." },
      { status: 500 },
    );
  }

  if (!data?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Nessun abbonamento Stripe gestibile disponibile." },
      { status: 400 },
    );
  }

  const baseUrl = getRequestBaseUrl(request);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${baseUrl}/professionista/abbonamento`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logApiError("BILLING_PORTAL ERROR", {
      query: "stripe billing portal session create",
      user_id: user.id,
      has_stripe_customer: true,
      base_url: baseUrl,
      error: err,
    });

    const isMissingStripeEnv =
      err instanceof Error && err.message.startsWith("Missing env: STRIPE_");

    return NextResponse.json(
      {
        error: isMissingStripeEnv
          ? "Gestione pagamenti temporaneamente non configurata."
          : "Non è stato possibile aprire la gestione dell’abbonamento. Riprova.",
      },
      { status: isMissingStripeEnv ? 503 : 500 },
    );
  }
}
