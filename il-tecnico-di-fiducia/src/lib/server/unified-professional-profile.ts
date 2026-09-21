import "server-only";

import {
  loadProfessionalProfile,
  loadPublicProfessionalProfile,
  type PublicProfessionalProfileDetails,
} from "@/lib/server/professional-profile";

type LoadProfessionalProfileArgs = Parameters<
  typeof loadProfessionalProfile
>[0];

type AuthenticatedViewer = LoadProfessionalProfileArgs["viewer"];

type AuthenticatedSupabase = LoadProfessionalProfileArgs["supabase"];

export type UnifiedProfessionalViewerContext = {
  id: string;
  role: "customer" | "professional" | "admin";
  isOwner: boolean;
  canViewContacts: boolean;
  isFollowing: boolean | null;
  contactStatus: "pending" | "accepted" | "rejected" | null;
  contacts: {
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
  } | null;
};

export type UnifiedProfessionalProfileResult = {
  profile: PublicProfessionalProfileDetails;
  viewerContext: UnifiedProfessionalViewerContext;
};

function normalizeContactStatus(
  value: unknown,
): "pending" | "accepted" | "rejected" | null {
  return value === "pending" || value === "accepted" || value === "rejected"
    ? value
    : null;
}

export async function loadUnifiedAuthenticatedProfessionalProfile({
  supabase,
  professionalId,
  viewer,
}: {
  supabase: AuthenticatedSupabase;
  professionalId: string;
  viewer: AuthenticatedViewer;
}): Promise<UnifiedProfessionalProfileResult | null> {
  const [publicProfile, authenticated] = await Promise.all([
    loadPublicProfessionalProfile(professionalId),
    loadProfessionalProfile({
      supabase,
      viewer,
      professionalId,
    }),
  ]);

  if (!publicProfile || !authenticated) {
    return null;
  }

  const isOwner = viewer.id === professionalId;

  const canViewContacts =
    isOwner ||
    viewer.role === "admin" ||
    authenticated.access.can_view_contacts === true;

  const contactStatus = normalizeContactStatus(
    authenticated.access.latest_contact_request?.status,
  );

  const isFollowing =
    viewer.role === "professional" && !isOwner
      ? (authenticated.access.is_following ?? false)
      : null;

  const contacts = canViewContacts
    ? {
        phone: authenticated.profile.phone ?? null,
        email:
          authenticated.profile.public_email ??
          authenticated.profile.email ??
          null,
        websiteUrl: authenticated.profile.website_url ?? null,
      }
    : null;

  return {
    profile: publicProfile,
    viewerContext: {
      id: viewer.id,
      role: viewer.role as "customer" | "professional" | "admin",
      isOwner,
      canViewContacts,
      isFollowing,
      contactStatus,
      contacts,
    },
  };
}
