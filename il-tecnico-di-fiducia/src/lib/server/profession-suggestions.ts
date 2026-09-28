import "server-only";

import { randomUUID } from "node:crypto";

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

type ProfessionSuggestionDeliveryData = ProfessionSuggestionEmailData & {
  admin_email_sent_at: string | null;
  user_email_sent_at: string | null;
};

type SuggestionEmailRecipient = "admin" | "user";

const EMAIL_SELECT =
  "id, profession_name, proposer_first_name, proposer_last_name, proposer_email, motivation, suggested_subcategories, amount_total, currency, admin_email_sent_at, user_email_sent_at";

function toStringId(value: unknown) {
  return typeof value === "string" ? value : (value?.toString?.() ?? null);
}

function metadataFromSession(session: Stripe.Checkout.Session) {
  return (session.metadata ?? {}) as ProfessionSuggestionSessionMetadata;
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

async function claimSuggestionEmail({
  service,
  suggestionId,
  recipient,
  claimToken,
}: {
  service: SupabaseClient;
  suggestionId: string;
  recipient: SuggestionEmailRecipient;
  claimToken: string;
}) {
  const { data, error } = await service.rpc(
    "claim_profession_suggestion_email",
    {
      target_suggestion_id: suggestionId,
      target_recipient: recipient,
      target_claim_token: claimToken,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data === true;
}

async function completeSuggestionEmail({
  service,
  suggestionId,
  recipient,
  claimToken,
  delivered,
}: {
  service: SupabaseClient;
  suggestionId: string;
  recipient: SuggestionEmailRecipient;
  claimToken: string;
  delivered: boolean;
}) {
  const { data, error } = await service.rpc(
    "complete_profession_suggestion_email",
    {
      target_suggestion_id: suggestionId,
      target_recipient: recipient,
      target_claim_token: claimToken,
      target_delivered: delivered,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data !== true) {
    throw new Error(
      `Profession suggestion ${recipient} email claim could not be completed`,
    );
  }
}

async function deliverSuggestionEmail({
  service,
  suggestion,
  recipient,
  alreadySentAt,
  send,
  stripeSessionId,
}: {
  service: SupabaseClient;
  suggestion: ProfessionSuggestionDeliveryData;
  recipient: SuggestionEmailRecipient;
  alreadySentAt: string | null;
  send: () => ReturnType<
    | typeof sendProfessionSuggestionAdminEmail
    | typeof sendProfessionSuggestionUserConfirmationEmail
  >;
  stripeSessionId: string;
}) {
  if (alreadySentAt) {
    console.info("[profession-suggestions] Email already delivered", {
      suggestion_id: suggestion.id,
      stripe_session_id: stripeSessionId,
      recipient,
    });
    return;
  }

  const claimToken = randomUUID();

  const claimed = await claimSuggestionEmail({
    service,
    suggestionId: suggestion.id,
    recipient,
    claimToken,
  });

  if (!claimed) {
    throw new Error(
      `Profession suggestion ${recipient} email delivery is already being processed`,
    );
  }

  try {
    const result = await send();

    if (!result.sent) {
      throw new Error(
        `Profession suggestion ${recipient} email was not delivered: ${result.reason}`,
      );
    }

    await completeSuggestionEmail({
      service,
      suggestionId: suggestion.id,
      recipient,
      claimToken,
      delivered: true,
    });

    console.info("[profession-suggestions] Email delivered", {
      suggestion_id: suggestion.id,
      stripe_session_id: stripeSessionId,
      recipient,
      message_id_present: Boolean(result.messageId),
    });
  } catch (error) {
    try {
      await completeSuggestionEmail({
        service,
        suggestionId: suggestion.id,
        recipient,
        claimToken,
        delivered: false,
      });
    } catch (releaseError) {
      logApiError("PROFESSION_SUGGESTION EMAIL CLAIM RELEASE ERROR", {
        suggestion_id: suggestion.id,
        stripe_session_id: stripeSessionId,
        recipient,
        error: releaseError,
      });
    }

    logApiError("PROFESSION_SUGGESTION EMAIL ERROR", {
      query:
        recipient === "admin"
          ? "send admin email"
          : "send user confirmation email",
      suggestion_id: suggestion.id,
      stripe_session_id: stripeSessionId,
      error,
    });

    throw error;
  }
}

async function deliverPendingSuggestionEmails({
  service,
  suggestion,
  stripeSessionId,
}: {
  service: SupabaseClient;
  suggestion: ProfessionSuggestionDeliveryData;
  stripeSessionId: string;
}) {
  await deliverSuggestionEmail({
    service,
    suggestion,
    recipient: "admin",
    alreadySentAt: suggestion.admin_email_sent_at,
    stripeSessionId,
    send: () => sendProfessionSuggestionAdminEmail(suggestion),
  });

  await deliverSuggestionEmail({
    service,
    suggestion,
    recipient: "user",
    alreadySentAt: suggestion.user_email_sent_at,
    stripeSessionId,
    send: () => sendProfessionSuggestionUserConfirmationEmail(suggestion),
  });
}

export function isProfessionSuggestionCheckoutSession(
  session: Stripe.Checkout.Session,
) {
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

  const { data: inserted, error } = await service
    .from("profession_suggestions")
    .insert(suggestion as never)
    .select(EMAIL_SELECT)
    .single();

  let emailData: ProfessionSuggestionDeliveryData;

  if (error) {
    const isDuplicate = error.code === "23505";

    if (!isDuplicate) {
      throw new Error(error.message);
    }

    const { data: existing, error: existingError } = await service
      .from("profession_suggestions")
      .select(EMAIL_SELECT)
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (existingError || !existing) {
      throw new Error(
        existingError?.message ??
          "Duplicate profession suggestion could not be reloaded",
      );
    }

    emailData = existing as ProfessionSuggestionDeliveryData;
  } else {
    emailData = inserted as ProfessionSuggestionDeliveryData;
  }

  await deliverPendingSuggestionEmails({
    service,
    suggestion: emailData,
    stripeSessionId: session.id,
  });

  return emailData;
}
