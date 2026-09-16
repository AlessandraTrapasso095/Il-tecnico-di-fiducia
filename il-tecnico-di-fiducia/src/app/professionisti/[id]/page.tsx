import { notFound, redirect } from "next/navigation";

import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";
import { PublicProfessionalProfile } from "@/components/public-profile/public-professional-profile";
import { createClient } from "@/lib/supabase/server";

import ProfessionalShell from "@/app/professionista/professional-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { CustomerAreaShell } from "@/components/customer/customer-area-shell";
import ProfessionalProfileClient from "@/components/professionals/professional-profile-client";
import {
  loadProfessionalProfile,
  loadPublicProfessionalProfile,
} from "@/lib/server/professional-profile";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

type ProfessionalProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfessionalProfilePage({
  params,
}: ProfessionalProfilePageProps) {
  const { id } = await params;

  const sessionClient = await createClient();
  const {
    data: { user: optionalUser },
  } = await sessionClient.auth.getUser();

  if (!optionalUser) {
    const publicProfile = await loadPublicProfessionalProfile(id);

    if (!publicProfile) {
      notFound();
    }

    return (
      <div className="flex min-h-dvh flex-col bg-surface">
        <TopNav />
        <main className="flex-1 pt-20 sm:pt-[100px]">
          <PublicProfessionalProfile profile={publicProfile} />
        </main>
        <Footer />
      </div>
    );
  }

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
      embeddedInCustomerShell={profile.role === "customer"}
      embeddedInAdminShell={profile.role === "admin"}
    />
  );

  if (profile.role === "customer") {
    return <CustomerAreaShell>{profileView}</CustomerAreaShell>;
  }

  if (profile.role === "admin") {
    return (
      <AdminShell
        title="Profilo professionista"
        subtitle="Vista amministratore del profilo reale."
        adminName={profile.first_name || profile.email}
      >
        {profileView}
      </AdminShell>
    );
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
