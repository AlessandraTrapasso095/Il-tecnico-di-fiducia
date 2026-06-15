import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole, ViewerProfile } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type ProfessionalProfileDetails = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  province_code: string | null;
  headline: string | null;
  bio: string | null;
  specializations: string[];
  avatar_url: string | null;
  cover_url: string | null;
  public_email: string | null;
  education: unknown[];
  work_experiences: unknown[];
  certifications: unknown[];
  services_offered: string[];
  operational_provinces: string[];
  available_remote: boolean;
  available_travel: boolean;
  rating_average: number | null;
  reviews_count: number;
  categories: { id: number; name: string; slug: string }[];
};

export type ProfessionalProfileAccess = {
  viewer_role: UserRole;
  is_owner: boolean;
  can_view_full_profile: boolean;
  can_view_contacts: boolean;
  is_following: boolean | null;
  latest_contact_request: {
    id: string;
    status: string;
    created_at: string;
  } | null;
  can_review: boolean;
};

type LoadProfessionalProfileOptions = {
  supabase: SupabaseClient;
  viewer: ViewerProfile;
  professionalId: string;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function loadProfessionalProfile({
  supabase,
  viewer,
  professionalId,
}: LoadProfessionalProfileOptions) {
  const isOwner = viewer.role === "professional" && viewer.id === professionalId;

  const { data: directory } = await supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, bio, specializations, avatar_url, cover_url, available_remote, available_travel",
    )
    .eq("id", professionalId)
    .maybeSingle();

  if (!directory && !isOwner && viewer.role !== "admin") {
    return null;
  }

  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id, email, first_name, last_name, province_code, phone")
    .eq("id", professionalId)
    .maybeSingle();

  const { data: professional } = await service
    .from("professional_profiles")
    .select(
      "id, headline, bio, specializations, avatar_url, cover_url, public_email, education, work_experiences, certifications, services_offered, operational_provinces, available_remote, available_travel",
    )
    .eq("id", professionalId)
    .maybeSingle();

  if (!profile || !professional) return null;

  let latestContactRequest: ProfessionalProfileAccess["latest_contact_request"] = null;
  let canViewContacts = isOwner || viewer.role === "admin";
  let isFollowing: boolean | null = null;
  let canViewFullProfile = isOwner || viewer.role === "admin" || viewer.role === "customer";

  if (viewer.role === "customer") {
    const { data: latest } = await supabase
      .from("contact_requests")
      .select("id, status, created_at")
      .eq("customer_id", viewer.id)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestContactRequest = latest ?? null;
    canViewContacts = latest?.status === "accepted";
  }

  if (viewer.role === "professional" && !isOwner) {
    const { data: follow } = await supabase
      .from("professional_follows")
      .select("followed_id")
      .eq("follower_id", viewer.id)
      .eq("followed_id", professionalId)
      .maybeSingle();

    isFollowing = !!follow;
    canViewFullProfile = !!follow;
    canViewContacts = !!follow;
  }

  const { data: categoriesMap } = await service
    .from("professional_categories")
    .select("category_id")
    .eq("professional_id", professionalId);

  const categoryIds = (categoriesMap ?? []).map((row) => row.category_id);
  const { data: categories } =
    categoryIds.length > 0
      ? await service
          .from("categories")
          .select("id, name, slug")
          .in("id", categoryIds)
      : { data: [] };

  const { data: reviews } = await service
    .from("reviews")
    .select("rating")
    .eq("professional_id", professionalId);

  const reviewRows = reviews ?? [];
  const reviewsCount = reviewRows.length;
  const ratingAverage =
    reviewsCount > 0
      ? reviewRows.reduce((sum, review) => sum + Number(review.rating), 0) / reviewsCount
      : null;

  const canReview =
    viewer.role === "customer" &&
    latestContactRequest?.status === "accepted" &&
    !isOwner;

  const details: ProfessionalProfileDetails = {
    id: professionalId,
    first_name: profile.first_name ?? directory?.first_name ?? "",
    last_name: profile.last_name ?? directory?.last_name ?? "",
    email: profile.email,
    phone: profile.phone,
    province_code: profile.province_code ?? directory?.province_code ?? null,
    headline: professional.headline ?? directory?.headline ?? null,
    bio: professional.bio ?? directory?.bio ?? null,
    specializations: toStringArray(professional.specializations),
    avatar_url: professional.avatar_url ?? directory?.avatar_url ?? null,
    cover_url: professional.cover_url ?? directory?.cover_url ?? null,
    public_email: professional.public_email,
    education: toJsonArray(professional.education),
    work_experiences: toJsonArray(professional.work_experiences),
    certifications: toJsonArray(professional.certifications),
    services_offered: toStringArray(professional.services_offered),
    operational_provinces: toStringArray(professional.operational_provinces),
    available_remote: Boolean(professional.available_remote),
    available_travel: Boolean(professional.available_travel),
    rating_average: ratingAverage,
    reviews_count: reviewsCount,
    categories: (categories ?? []) as { id: number; name: string; slug: string }[],
  };

  const access: ProfessionalProfileAccess = {
    viewer_role: viewer.role,
    is_owner: isOwner,
    can_view_full_profile: canViewFullProfile,
    can_view_contacts: canViewContacts,
    is_following: isFollowing,
    latest_contact_request: latestContactRequest,
    can_review: canReview,
  };

  return { profile: details, access };
}
