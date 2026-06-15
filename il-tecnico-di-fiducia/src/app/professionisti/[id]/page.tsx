import { notFound, redirect } from "next/navigation";

import ProfessionalShell from "@/app/professionista/professional-shell";
import ProfessionalProfileClient from "@/components/professionals/professional-profile-client";
import { loadProfessionalProfile } from "@/lib/server/professional-profile";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

type ProfessionalProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfessionalProfilePage({
  params,
}: ProfessionalProfilePageProps) {
  const { id } = await params;
  const { supabase, user, profile } = await requirePageAuth({
    allowedRoles: ["customer", "professional", "admin"],
  });

  if (profile.role === "professional" && id === user.id) {
    redirect("/professionista/profilo");
  }

  const data = await loadProfessionalProfile({
    supabase,
    viewer: profile,
    professionalId: id,
  });

  if (!data) {
    notFound();
  }

  const profileView = (
    <ProfessionalProfileClient
      initialProfile={data.profile}
      access={data.access}
      viewer={{ id: user.id, role: profile.role }}
      embeddedInProfessionalShell={profile.role === "professional"}
    />
  );

  if (profile.role !== "professional") {
    return profileView;
  }

  const { data: professionalProfile } = await supabase
    .from("professional_profiles")
    .select("avatar_url")
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <ProfessionalShell
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
        phone: profile.phone,
        avatar_url: professionalProfile?.avatar_url ?? null,
      }}
    >
      {profileView}
    </ProfessionalShell>
  );
}
