import SubscriptionSettingsClient from "./subscription-settings-client";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function ProfessionalSubscriptionSettingsPage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["professional"] });

  return (
    <SubscriptionSettingsClient
      profile={{
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      }}
    />
  );
}
