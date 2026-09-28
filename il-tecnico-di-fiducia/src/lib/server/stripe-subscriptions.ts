import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import {
  mapStripeSubscriptionStatus,
  type AppSubscriptionStatus,
} from "@/lib/stripe-subscription-status";

export { mapStripeSubscriptionStatus };
export type { AppSubscriptionStatus };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function resolveProfessionalIdForStripeSubscription(
  serviceSupabase: SupabaseClient,
  subscription: Stripe.Subscription,
) {
  const fromMetadata = subscription.metadata?.professional_id;
  if (isUuid(fromMetadata)) return fromMetadata;

  const { data, error } = await serviceSupabase
    .from("professional_subscriptions")
    .select("professional_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.professional_id ?? null;
}

export async function applyProfessionalSubscriptionStateFromStripe(
  serviceSupabase: SupabaseClient,
  args: {
    professionalId: string;
    status: AppSubscriptionStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    stripeEventId: string;
    stripeEventCreated: number;
  },
) {
  const { data, error } = await serviceSupabase.rpc(
    "apply_stripe_subscription_event",
    {
      target_professional_id: args.professionalId,
      target_status: args.status,
      target_stripe_customer_id: args.stripeCustomerId,
      target_stripe_subscription_id: args.stripeSubscriptionId,
      target_current_period_end: args.currentPeriodEnd,
      target_stripe_event_id: args.stripeEventId,
      target_stripe_event_created: args.stripeEventCreated,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Stripe subscription event did not return a database row");
  }

  return {
    professional_id: row.professional_id as string,
    status: row.status as AppSubscriptionStatus,
    stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id:
      (row.stripe_subscription_id as string | null) ?? null,
    current_period_end: (row.current_period_end as string | null) ?? null,
    stripe_last_event_id: (row.stripe_last_event_id as string | null) ?? null,
    stripe_last_event_created:
      (row.stripe_last_event_created as number | null) ?? null,
    applied: Boolean(row.applied),
  };
}

export async function upsertProfessionalSubscriptionFromStripe(
  serviceSupabase: SupabaseClient,
  args: {
    professionalId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeStatus: Stripe.Subscription.Status;
    currentPeriodEnd: number | null;
    stripeEventId: string;
    stripeEventCreated: number;
  },
) {
  const nextStatus = mapStripeSubscriptionStatus(args.stripeStatus);

  const currentPeriodEnd =
    typeof args.currentPeriodEnd === "number" && args.currentPeriodEnd > 0
      ? new Date(args.currentPeriodEnd * 1000).toISOString()
      : null;

  return applyProfessionalSubscriptionStateFromStripe(serviceSupabase, {
    professionalId: args.professionalId,
    status: nextStatus,
    stripeCustomerId: args.stripeCustomerId,
    stripeSubscriptionId: args.stripeSubscriptionId,
    currentPeriodEnd,
    stripeEventId: args.stripeEventId,
    stripeEventCreated: args.stripeEventCreated,
  });
}
