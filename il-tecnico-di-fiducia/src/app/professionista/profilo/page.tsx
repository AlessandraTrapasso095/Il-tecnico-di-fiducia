import { notFound } from "next/navigation";

import ProfessionalProfileClient from "@/components/professionals/professional-profile-client";
import { loadProfessionalProfile } from "@/lib/server/professional-profile";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function OwnProfessionalProfilePage() {
  const { supabase, user, profile } = await requirePageAuth({
    allowedRoles: ["professional"],
  });

  const data = await loadProfessionalProfile({
    supabase,
    viewer: profile,
    professionalId: user.id,
  });

  if (!data) {
    notFound();
  }

  return (
    <ProfessionalProfileClient
      initialProfile={data.profile}
      access={data.access}
      viewer={{ id: user.id, role: profile.role }}
      embeddedInProfessionalShell
    />
  );
}
