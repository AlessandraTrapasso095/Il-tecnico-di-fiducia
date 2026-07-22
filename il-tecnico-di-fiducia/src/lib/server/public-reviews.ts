import "server-only";

import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

export type PublicHomepageReview = {
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  customer: {
    display_name: string;
    initials: string;
    avatar_url: string | null;
  };
  professional: {
    display_name: string;
    headline: string | null;
    avatar_url: string | null;
  };
};

type ReviewRow = {
  id: string;
  professional_id: string;
  customer_id: string;
  rating: number;
  title?: string | null;
  body: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProfessionalDetailsRow = {
  id: string;
  headline: string | null;
  avatar_url: string | null;
};

function isMissingReviewTitleColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const haystack = `${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();
  return (
    ["42703", "PGRST204", "PGRST205"].includes(record.code ?? "") &&
    haystack.includes("title")
  );
}

function displayName(profile: ProfileRow | null | undefined, fallback: string) {
  return `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || fallback;
}

function customerDisplayName(profile: ProfileRow | null | undefined) {
  const firstName = profile?.first_name?.trim();
  const lastInitial = profile?.last_name?.trim().slice(0, 1).toUpperCase();

  if (!firstName && !lastInitial) return "Cliente verificato";
  return [firstName, lastInitial ? `${lastInitial}.` : ""].filter(Boolean).join(" ");
}

function initials(profile: ProfileRow | null | undefined) {
  const first = profile?.first_name?.trim().slice(0, 1).toUpperCase() ?? "";
  const last = profile?.last_name?.trim().slice(0, 1).toUpperCase() ?? "";
  return `${first}${last}` || "CV";
}

function cleanBody(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function getPublicHomepageReviews(): Promise<PublicHomepageReview[]> {
  try {
    const service = createServiceClient();

    const selectWithTitle =
      "id, professional_id, customer_id, rating, title, body, created_at";
    const selectWithoutTitle =
      "id, professional_id, customer_id, rating, body, created_at";

    const initialReviewsQuery = await service
      .from("reviews")
      .select(selectWithTitle)
      .gte("rating", 4)
      .not("body", "is", null)
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    let data = initialReviewsQuery.data as ReviewRow[] | null;
    let error = initialReviewsQuery.error;

    if (isMissingReviewTitleColumn(error)) {
      logApiError("PUBLIC_REVIEWS ERROR", {
        query: "reviews select with title",
        error,
      });
      const fallback = await service
        .from("reviews")
        .select(selectWithoutTitle)
        .gte("rating", 4)
        .not("body", "is", null)
        .order("rating", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      data = fallback.data as ReviewRow[] | null;
      error = fallback.error;
    }

    if (error) {
      logApiError("PUBLIC_REVIEWS ERROR", {
        query: "reviews public positive list",
        error,
      });
      return [];
    }

    const reviewRows = ((data ?? []) as ReviewRow[]).filter(
      (review) => Number(review.rating) >= 4 && cleanBody(review.body).length > 0,
    );
    const customerIds = Array.from(new Set(reviewRows.map((review) => review.customer_id)));
    const professionalIds = Array.from(
      new Set(reviewRows.map((review) => review.professional_id)),
    );

    const [
      { data: customers, error: customersError },
      { data: professionals, error: professionalsError },
      { data: professionalDetails, error: professionalDetailsError },
    ] = await Promise.all([
      customerIds.length > 0
        ? service
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      professionalIds.length > 0
        ? service
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", professionalIds)
        : Promise.resolve({ data: [], error: null }),
      professionalIds.length > 0
        ? service
            .from("professional_profiles")
            .select("id, headline, avatar_url")
            .in("id", professionalIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (customersError) {
      logApiError("PUBLIC_REVIEWS ERROR", {
        query: "profiles select customers",
        error: customersError,
      });
    }

    if (professionalsError) {
      logApiError("PUBLIC_REVIEWS ERROR", {
        query: "profiles select professionals",
        error: professionalsError,
      });
    }

    if (professionalDetailsError) {
      logApiError("PUBLIC_REVIEWS ERROR", {
        query: "professional_profiles select details",
        error: professionalDetailsError,
      });
    }

    const customersById = new Map(
      ((customers ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    const professionalsById = new Map(
      ((professionals ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    const professionalDetailsById = new Map(
      ((professionalDetails ?? []) as ProfessionalDetailsRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const publicReviews = reviewRows.flatMap((review): PublicHomepageReview[] => {
      const customer = customersById.get(review.customer_id);
      const professional = professionalsById.get(review.professional_id);
      const details = professionalDetailsById.get(review.professional_id);

      if (!customer || !professional || !details) return [];

      return [
        {
          rating: Number(review.rating),
          title: review.title ?? null,
          body: cleanBody(review.body),
          created_at: review.created_at,
          customer: {
            display_name: customerDisplayName(customer),
            initials: initials(customer),
            avatar_url: null,
          },
          professional: {
            display_name: displayName(professional, "Professionista verificato"),
            headline: details.headline,
            avatar_url: details.avatar_url,
          },
        },
      ];
    });

    return publicReviews
      .sort((a, b) => {
        const ratingDelta = b.rating - a.rating;
        if (ratingDelta !== 0) return ratingDelta;

        const lengthDelta = b.body.length - a.body.length;
        if (lengthDelta !== 0) return lengthDelta;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 10);
  } catch (error) {
    logApiError("PUBLIC_REVIEWS ERROR", {
      query: "getPublicHomepageReviews",
      error,
    });
    return [];
  }
}
