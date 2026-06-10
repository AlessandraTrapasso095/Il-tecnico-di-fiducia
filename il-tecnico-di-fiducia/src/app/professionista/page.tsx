import ProfessionalDashboardClient from "./professional-dashboard-client";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function ProfessionalHomePage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["professional"] });

  return (
    <ProfessionalDashboardClient
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
        phone: profile.phone,
      }}
    />
  );
}
