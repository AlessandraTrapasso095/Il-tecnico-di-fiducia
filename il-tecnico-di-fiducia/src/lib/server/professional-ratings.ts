import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfessionalRatingFields = {
  id: string;
};

export type ProfessionalWithRating<T extends ProfessionalRatingFields> = T & {
  rating_average: number | null;
  reviews_count: number;
};

export async function attachProfessionalRatings<T extends ProfessionalRatingFields>(
  supabase: SupabaseClient,
  professionals: T[],
): Promise<ProfessionalWithRating<T>[]> {
  const ids = professionals.map((professional) => professional.id);
  if (ids.length === 0) {
    return [];
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("professional_id, rating")
    .in("professional_id", ids);

  if (error) {
    return professionals.map((professional) => ({
      ...professional,
      rating_average: null,
      reviews_count: 0,
    }));
  }

  const aggregate = new Map<string, { count: number; sum: number }>();
  for (const review of reviews ?? []) {
    const professionalId =
      typeof review.professional_id === "string" ? review.professional_id : null;
    const rating = Number(review.rating);
    if (!professionalId || !Number.isFinite(rating)) continue;

    const current = aggregate.get(professionalId) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += rating;
    aggregate.set(professionalId, current);
  }

  return professionals.map((professional) => {
    const rating = aggregate.get(professional.id);
    return {
      ...professional,
      rating_average: rating && rating.count > 0 ? rating.sum / rating.count : null,
      reviews_count: rating?.count ?? 0,
    };
  });
}
