import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { logApiError } from "@/lib/server/api-logger";
import {
  sendProfessionSuggestionAdminEmail,
  sendProfessionSuggestionUserConfirmationEmail,
  type ProfessionSuggestionEmailData,
} from "@/lib/server/profession-suggestion-emails";

type ProfessionSuggestionSessionMetadata = {
  source?: string;
  profession_name?: string;
  proposer_email?: string;
  proposer_name?: string;
  proposer_first_name?: string;
  proposer_last_name?: string;
  motivation?: string;
  suggested_subcategories?: string;
};

function toStringId(value: unknown) {
  return typeof value === "string" ? value : value?.toString?.() ?? null;
}

function metadataFromSession(session: Stripe.Checkout.Session) {
  return (session.metadata ?? {}) as ProfessionSuggestionSessionMetadata;
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isProfessionSuggestionCheckoutSession(session: Stripe.Checkout.Session) {
  return metadataFromSession(session).source === "profession_suggestion";
}

export async function recordProfessionSuggestionFromCheckout({
  service,
  session,
  stripeEventId,
  paidAt,
}: {
  service: SupabaseClient;
  session: Stripe.Checkout.Session;
  stripeEventId: string;
  paidAt: string;
}) {
  const metadata = metadataFromSession(session);

  if (session.payment_status !== "paid") {
    console.info("[profession-suggestions] Checkout session not paid yet", {
      stripe_session_id: session.id,
      payment_status: session.payment_status,
    });
    return null;
  }

  const suggestion = {
    profession_name: clean(metadata.profession_name),
    proposer_first_name: clean(metadata.proposer_first_name),
    proposer_last_name: clean(metadata.proposer_last_name),
    proposer_email: clean(metadata.proposer_email).toLowerCase(),
    motivation: clean(metadata.motivation),
    suggested_subcategories: clean(metadata.suggested_subcategories) || null,
    status: "pending",
    payment_status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: toStringId(session.payment_intent),
    stripe_customer_id: toStringId(session.customer),
    stripe_event_id: stripeEventId,
    amount_total: session.amount_total ?? null,
    currency: session.currency ?? null,
    paid_at: paidAt,
  };

  if (
    !suggestion.profession_name ||
    !suggestion.proposer_first_name ||
    !suggestion.proposer_last_name ||
    !suggestion.proposer_email ||
    !suggestion.motivation
  ) {
    throw new Error("Profession suggestion checkout metadata is incomplete");
  }

  const { data, error } = await service
    .from("profession_suggestions")
    .upsert(suggestion as never, { onConflict: "stripe_checkout_session_id" })
    .select(
      "id, profession_name, proposer_first_name, proposer_last_name, proposer_email, motivation, suggested_subcategories, amount_total, currency",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const emailData = data as ProfessionSuggestionEmailData;

  await Promise.allSettled([
    sendProfessionSuggestionAdminEmail(emailData),
    sendProfessionSuggestionUserConfirmationEmail(emailData),
  ]).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logApiError("PROFESSION_SUGGESTION EMAIL ERROR", {
          query: index === 0 ? "send admin email" : "send user confirmation email",
          suggestion_id: emailData.id,
          stripe_session_id: session.id,
          error: result.reason,
        });
      }
    });
  });

  return emailData;
}
