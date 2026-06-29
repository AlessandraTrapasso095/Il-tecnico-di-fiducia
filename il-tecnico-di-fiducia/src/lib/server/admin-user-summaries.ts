import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUserSummary = {
  id: string;
  role: "customer" | "professional" | "admin";
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
  activity: { last_seen_at: string | null } | null;
  subscription: {
    professional_id: string;
    status: "none" | "stripe_active" | "stripe_canceled" | "suspended" | "admin_forced_active";
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
    updated_at: string;
  } | null;
  professional_directory: {
    id: string;
    headline: string | null;
    specializations: string[] | null;
    available_remote: boolean | null;
    available_travel: boolean | null;
  } | null;
};

type ProfileRow = Omit<
  AdminUserSummary,
  "avatar_url" | "activity" | "subscription" | "professional_directory"
>;

export async function loadAdminUserSummaries(
  service: SupabaseClient,
  userIds: string[],
) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const usersById = new Map<string, AdminUserSummary>();

  if (uniqueIds.length === 0) {
    return usersById;
  }

  const { data: profiles, error: profilesError } = await service
    .from("profiles")
    .select(
      "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, suspended_until, created_at, updated_at",
    )
    .in("id", uniqueIds);

  if (profilesError) {
    throw profilesError;
  }

  const rows = (profiles ?? []) as ProfileRow[];
  const professionalIds = rows
    .filter((profile) => profile.role === "professional")
    .map((profile) => profile.id);

  const [
    { data: avatars },
    { data: activities },
    { data: subscriptions },
    { data: directories },
  ] = await Promise.all([
    professionalIds.length > 0
      ? service.from("professional_profiles").select("id, avatar_url").in("id", professionalIds)
      : Promise.resolve({ data: [] }),
    service.from("user_activity").select("user_id, last_seen_at").in("user_id", uniqueIds),
    professionalIds.length > 0
      ? service
          .from("professional_subscriptions")
          .select(
            "professional_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at",
          )
          .in("professional_id", professionalIds)
      : Promise.resolve({ data: [] }),
    professionalIds.length > 0
      ? service
          .from("professional_directory")
          .select("id, headline, specializations, available_remote, available_travel")
          .in("id", professionalIds)
      : Promise.resolve({ data: [] }),
  ]);

  const avatarById = new Map(
    ((avatars ?? []) as { id: string; avatar_url: string | null }[]).map((row) => [
      row.id,
      row.avatar_url,
    ]),
  );
  const activityById = new Map(
    ((activities ?? []) as { user_id: string; last_seen_at: string | null }[]).map((row) => [
      row.user_id,
      { last_seen_at: row.last_seen_at },
    ]),
  );
  const subscriptionById = new Map(
    ((subscriptions ?? []) as NonNullable<AdminUserSummary["subscription"]>[]).map((row) => [
      row.professional_id,
      row,
    ]),
  );
  const directoryById = new Map(
    ((directories ?? []) as NonNullable<AdminUserSummary["professional_directory"]>[]).map(
      (row) => [row.id, row],
    ),
  );

  for (const profile of rows) {
    usersById.set(profile.id, {
      ...profile,
      avatar_url: avatarById.get(profile.id) ?? null,
      activity: activityById.get(profile.id) ?? null,
      subscription: subscriptionById.get(profile.id) ?? null,
      professional_directory: directoryById.get(profile.id) ?? null,
    });
  }

  return usersById;
}
