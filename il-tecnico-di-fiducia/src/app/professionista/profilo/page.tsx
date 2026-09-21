import { notFound } from "next/navigation";

import { PublicProfessionalProfile } from "@/components/public-profile/public-professional-profile";
import { requirePageAuth } from "@/lib/server/require-page-auth";
import { loadUnifiedAuthenticatedProfessionalProfile } from "@/lib/server/unified-professional-profile";

export const dynamic = "force-dynamic";

type OwnerProfilePageProps = {
  searchParams: Promise<{
    tab?: string;
    review?: string;
  }>;
};

function ownerInitialTab(
  value: string | undefined,
): "profile" | "works" | "reviews" {
  if (value === "reviews") {
    return "reviews";
  }

  if (value === "works") {
    return "works";
  }

  return "profile";
}

export default async function OwnerProfessionalProfilePage({
  searchParams,
}: OwnerProfilePageProps) {
  const params = await searchParams;

  const { supabase, user, profile } = await requirePageAuth({
    allowedRoles: ["professional"],
  });

  const unified = await loadUnifiedAuthenticatedProfessionalProfile({
    supabase,
    professionalId: user.id,
    viewer: profile,
  });

  if (!unified) {
    notFound();
  }

  return (
    <PublicProfessionalProfile
      profile={unified.profile}
      viewerContext={unified.viewerContext}
      initialTab={ownerInitialTab(params.tab)}
    />
  );
}
