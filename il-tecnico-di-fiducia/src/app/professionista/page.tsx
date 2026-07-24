import ProfessionalDashboardClient from "./professional-dashboard-client";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function ProfessionalHomePage() {
  const { supabase, profile } = await requirePageAuth({ allowedRoles: ["professional"] });
  const { data: professionalProfile } = await supabase
    .from("professional_profiles")
    .select("avatar_url")
    .eq("id", profile.id)
    .maybeSingle();
  const { data: categoryLinks } = await supabase
    .from("professional_categories")
    .select("category_id")
    .eq("professional_id", profile.id)
    .limit(1);

  return (
    <ProfessionalDashboardClient
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
        phone: profile.phone,
        avatar_url: professionalProfile?.avatar_url ?? null,
        has_category: Boolean(categoryLinks?.length),
      }}
    />
  );
}
