import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type AppSubscriptionStatus =
  | "none"
  | "stripe_active"
  | "admin_forced_active"
  | "suspended";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): Exclude<AppSubscriptionStatus, "admin_forced_active"> {
  if (stripeStatus === "active" || stripeStatus === "trialing") {
    return "stripe_active";
  }

  // These states indicate access should be paused immediately.
  if (
    stripeStatus === "past_due" ||
    stripeStatus === "unpaid" ||
    stripeStatus === "paused"
  ) {
    return "suspended";
  }

  // canceled / incomplete / incomplete_expired
  return "none";
}

export async function resolveProfessionalIdForStripeSubscription(
  serviceSupabase: SupabaseClient,
  subscription: Stripe.Subscription,
) {
  const fromMetadata = subscription.metadata?.professional_id;
  if (isUuid(fromMetadata)) return fromMetadata;

  const { data } = await serviceSupabase
    .from("professional_subscriptions")
    .select("professional_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  return data?.professional_id ?? null;
}

export async function upsertProfessionalSubscriptionFromStripe(
  serviceSupabase: SupabaseClient,
  args: {
    professionalId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeStatus: Stripe.Subscription.Status;
    currentPeriodEnd: number | null;
  },
) {
  const nextStatus = mapStripeSubscriptionStatus(args.stripeStatus);
  const currentPeriodEnd =
    typeof args.currentPeriodEnd === "number" && args.currentPeriodEnd > 0
      ? new Date(args.currentPeriodEnd * 1000).toISOString()
      : null;

  const nextRow = {
    professional_id: args.professionalId,
    status: nextStatus,
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    current_period_end: currentPeriodEnd,
  };

  const { error } = await serviceSupabase
    .from("professional_subscriptions")
    .upsert(nextRow as never, { onConflict: "professional_id" });

  if (error) {
    throw new Error(error.message);
  }

  return nextRow;
}

