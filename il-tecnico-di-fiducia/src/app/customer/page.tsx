import CustomerDashboardClient from "./customer-dashboard-client";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["customer"] });

  return (
    <CustomerDashboardClient
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      }}
    />
  );
}

