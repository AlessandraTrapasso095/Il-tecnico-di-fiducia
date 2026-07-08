import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";

export type SubscriptionDiscountCode = {
  id: string;
  stripe_coupon_id: string;
  stripe_promotion_code_id: string;
  code: string;
  title: string;
  percent_off: number;
  starts_at: string | null;
  expires_at: string | null;
  applies_to_all: boolean;
  professional_id: string | null;
  professional_email: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicSubscriptionDiscountCode = Pick<
  SubscriptionDiscountCode,
  "id" | "code" | "title" | "percent_off" | "starts_at" | "expires_at"
>;

type ProfessionalRecipient = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

type SubscriptionRow = {
  professional_id: string;
  status: string;
  current_period_end: string | null;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function dateIsAfterNow(value: string | null | undefined) {
  if (!value) return true;
  return new Date(value).getTime() > Date.now();
}

function dateIsBeforeNow(value: string | null | undefined) {
  if (!value) return true;
  return new Date(value).getTime() <= Date.now();
}

export function subscriptionIsCurrentlyActive(subscription: SubscriptionRow | null | undefined) {
  if (!subscription) return false;
  if (subscription.status !== "stripe_active" && subscription.status !== "admin_forced_active") {
    return false;
  }

  return dateIsAfterNow(subscription.current_period_end);
}

export function discountIsCurrentlyValid(
  discount: Pick<SubscriptionDiscountCode, "is_active" | "starts_at" | "expires_at">,
) {
  return (
    discount.is_active &&
    dateIsBeforeNow(discount.starts_at) &&
    dateIsAfterNow(discount.expires_at)
  );
}

export function publicDiscountCode(
  discount: SubscriptionDiscountCode | null,
): PublicSubscriptionDiscountCode | null {
  if (!discount) return null;

  return {
    id: discount.id,
    code: discount.code,
    title: discount.title,
    percent_off: discount.percent_off,
    starts_at: discount.starts_at,
    expires_at: discount.expires_at,
  };
}

export async function loadActiveDiscountForProfessional(
  professionalId: string,
  client: SupabaseClient = createServiceClient(),
) {
  const { data: profile } = await client
    .from("profiles")
    .select("id, email")
    .eq("id", professionalId)
    .maybeSingle();

  const professionalEmail = normalizeEmail(profile?.email);

  const { data } = await client
    .from("subscription_discount_codes")
    .select("*")
    .eq("is_active", true)
    .order("applies_to_all", { ascending: true })
    .order("percent_off", { ascending: false })
    .order("created_at", { ascending: false });

  const discounts = ((data ?? []) as SubscriptionDiscountCode[]).filter((discount) => {
    if (!discountIsCurrentlyValid(discount)) return false;
    if (discount.applies_to_all) return true;
    if (discount.professional_id === professionalId) return true;
    return normalizeEmail(discount.professional_email) === professionalEmail;
  });

  return discounts[0] ?? null;
}

export async function loadEligibleDiscountRecipients(
  options:
    | { appliesToAll: true }
    | { appliesToAll: false; professionalEmail: string },
  client: SupabaseClient = createServiceClient(),
): Promise<ProfessionalRecipient[]> {
  let profileQuery = client
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("role", "professional")
    .eq("is_banned", false);

  if (!options.appliesToAll) {
    profileQuery = profileQuery.ilike("email", options.professionalEmail.trim());
  }

  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    profileQuery,
    client
      .from("professional_subscriptions")
      .select("professional_id, status, current_period_end"),
  ]);

  const subscriptionByProfessionalId = new Map(
    ((subscriptions ?? []) as SubscriptionRow[]).map((subscription) => [
      subscription.professional_id,
      subscription,
    ]),
  );

  return ((profiles ?? []) as ProfessionalRecipient[]).filter((profile) => {
    return !subscriptionIsCurrentlyActive(subscriptionByProfessionalId.get(profile.id));
  });
}
