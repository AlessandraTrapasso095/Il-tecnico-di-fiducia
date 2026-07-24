import { NextResponse } from "next/server";

import { getRequestBaseUrl } from "@/lib/api/base-url";
import { isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import {
  getStripe,
  getStripeProfessionSuggestionPriceId,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

type ProfessionSuggestionCheckoutPayload = {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  profession_name?: unknown;
  motivation?: unknown;
  suggested_subcategories?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function metadataValue(value: string, maxLength = 500) {
  return value.slice(0, maxLength);
}

export async function POST(request: Request) {
  let payload: ProfessionSuggestionCheckoutPayload;

  try {
    payload = (await request.json()) as ProfessionSuggestionCheckoutPayload;
  } catch {
    return NextResponse.json({ error: "Payload non valido." }, { status: 400 });
  }

  const firstName = normalize(payload.first_name, 80);
  const lastName = normalize(payload.last_name, 80);
  const email = normalize(payload.email, 180).toLowerCase();
  const professionName = normalize(payload.profession_name, 120);
  const motivation = normalize(payload.motivation, 450);
  const suggestedSubcategories = normalize(payload.suggested_subcategories, 350);

  if (!isNonEmptyString(firstName)) {
    return NextResponse.json({ error: "Inserisci il nome." }, { status: 400 });
  }

  if (!isNonEmptyString(lastName)) {
    return NextResponse.json({ error: "Inserisci il cognome." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Inserisci un’email valida." }, { status: 400 });
  }

  if (!isNonEmptyString(professionName)) {
    return NextResponse.json(
      { error: "Inserisci la figura professionale proposta." },
      { status: 400 },
    );
  }

  if (motivation.length < 20) {
    return NextResponse.json(
      { error: "Inserisci una motivazione di almeno 20 caratteri." },
      { status: 400 },
    );
  }

  const baseUrl = getRequestBaseUrl(request);

  try {
    const stripe = getStripe();
    const priceId = getStripeProfessionSuggestionPriceId();
    const proposerName = `${firstName} ${lastName}`.trim();
    const metadata = {
      source: "profession_suggestion",
      profession_name: metadataValue(professionName, 120),
      proposer_email: metadataValue(email, 180),
      proposer_name: metadataValue(proposerName, 160),
      proposer_first_name: metadataValue(firstName, 80),
      proposer_last_name: metadataValue(lastName, 80),
      motivation: metadataValue(motivation, 450),
      suggested_subcategories: metadataValue(suggestedSubcategories, 350),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      payment_intent_data: {
        metadata,
      },
      success_url: `${baseUrl}/proponi-un-tecnico/successo?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/proponi-un-tecnico?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe non ha restituito un URL di checkout." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logApiError("PROFESSION_SUGGESTION_CHECKOUT ERROR", {
      query: "stripe checkout session create",
      base_url: baseUrl,
      email_present: Boolean(email),
      profession_name_present: Boolean(professionName),
      error,
    });

    const missingStripeEnv =
      error instanceof Error && error.message.startsWith("Missing env: STRIPE_");

    return NextResponse.json(
      {
        error: missingStripeEnv
          ? "Pagamento temporaneamente non configurato. Riprova più tardi."
          : "Non è stato possibile avviare il pagamento. Riprova.",
      },
      { status: missingStripeEnv ? 503 : 500 },
    );
  }
}
