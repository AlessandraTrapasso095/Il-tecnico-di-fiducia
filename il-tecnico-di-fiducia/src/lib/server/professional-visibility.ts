import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";

const CUSTOMER_VISIBLE_SUBSCRIPTION_STATUSES = new Set([
  "stripe_active",
  "admin_forced_active",
]);

type SubscriptionRow = {
  professional_id: string;
  status: string;
  current_period_end: string | null;
};

type ProfileStatusRow = {
  id: string;
  role: string;
  is_banned: boolean | null;
  suspended_until: string | null;
};

function isSubscriptionActive(row: SubscriptionRow, nowMs = Date.now()) {
  if (!CUSTOMER_VISIBLE_SUBSCRIPTION_STATUSES.has(row.status)) return false;
  if (!row.current_period_end) return true;
  return new Date(row.current_period_end).getTime() > nowMs;
}

function isProfileActive(row: ProfileStatusRow, nowMs = Date.now()) {
  if (row.role !== "professional") return false;
  if (row.is_banned === true) return false;
  if (!row.suspended_until) return true;
  return new Date(row.suspended_until).getTime() <= nowMs;
}

export async function loadCustomerVisibleProfessionalIds(
  professionalIds?: string[],
  client?: SupabaseClient,
) {
  const service = client ?? createServiceClient();
  const ids = professionalIds ? Array.from(new Set(professionalIds.filter(Boolean))) : null;

  if (ids && ids.length === 0) return new Set<string>();

  let subscriptionQuery = service
    .from("professional_subscriptions")
    .select("professional_id, status, current_period_end")
    .in("status", [...CUSTOMER_VISIBLE_SUBSCRIPTION_STATUSES]);

  if (ids) {
    subscriptionQuery = subscriptionQuery.in("professional_id", ids);
  }

  const { data: subscriptions, error: subscriptionError } = await subscriptionQuery;
  if (subscriptionError || !subscriptions?.length) return new Set<string>();

  const nowMs = Date.now();
  const subscribedIds = Array.from(
    new Set(
      (subscriptions as SubscriptionRow[])
        .filter((subscription) => isSubscriptionActive(subscription, nowMs))
        .map((subscription) => subscription.professional_id),
    ),
  );

  if (subscribedIds.length === 0) return new Set<string>();

  const { data: profiles, error: profileError } = await service
    .from("profiles")
    .select("id, role, is_banned, suspended_until")
    .in("id", subscribedIds);

  if (profileError || !profiles?.length) return new Set<string>();

  return new Set(
    (profiles as ProfileStatusRow[])
      .filter((profile) => isProfileActive(profile, nowMs))
      .map((profile) => profile.id),
  );
}

export async function isProfessionalVisibleToCustomers(
  professionalId: string,
  client?: SupabaseClient,
) {
  if (!professionalId) return false;
  const visibleIds = await loadCustomerVisibleProfessionalIds([professionalId], client);
  return visibleIds.has(professionalId);
}
