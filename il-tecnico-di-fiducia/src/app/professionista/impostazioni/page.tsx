import AccountSettingsClient from "@/components/account/account-settings-client";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

const DEFAULT_PREFERENCES = {
  new_requests: true,
  messages: true,
  reviews: true,
  email: true,
};

export default async function ProfessionalSettingsPage() {
  const { supabase, profile } = await requirePageAuth({ allowedRoles: ["professional"] });

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("new_requests, messages, reviews, email")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <AccountSettingsClient
      areaLabel="Area professionista"
      requireProvince
      profile={{
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
        phone: profile.phone,
      }}
      preferences={{
        ...DEFAULT_PREFERENCES,
        ...(preferences ?? {}),
      }}
    />
  );
}
