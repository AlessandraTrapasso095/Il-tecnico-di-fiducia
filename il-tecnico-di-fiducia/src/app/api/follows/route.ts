import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { ensureSocialNotification } from "@/lib/server/social-notifications";
import { createServiceClient } from "@/lib/supabase/service";

type FollowPayload = {
  followed_id: string;
};

type FollowedProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  subcategory_id?: string | null;
  province_code: string | null;
  categories?: FollowedProfessionalCategory[];
  subcategory?: FollowedProfessionalSubcategory | null;
};

type CategoryId = string | number;

type FollowedProfessionalCategory = {
  id: CategoryId | null;
  name: string;
  slug: string;
};

type FollowedProfessionalSubcategory = {
  id: string;
  category_id: CategoryId;
  name: string;
  slug: string;
};

async function attachTaxonomy(professionals: FollowedProfessionalRow[]) {
  if (professionals.length === 0) return professionals;

  const service = createServiceClient();
  const professionalIds = professionals.map((professional) => professional.id);
  const { data: mappings } = await service
    .from("professional_categories")
    .select("professional_id, category_id")
    .in("professional_id", professionalIds);

  const categoryIds = Array.from(
    new Set((mappings ?? []).map((mapping) => mapping.category_id).filter(Boolean)),
  );
  const { data: categories } =
    categoryIds.length > 0
      ? await service
          .from("categories")
          .select("id, name, slug")
          .in("id", categoryIds)
          .eq("is_active", true)
      : { data: [] };

  const subcategoryIds = Array.from(
    new Set(
      professionals
        .map((professional) => professional.subcategory_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: subcategories } =
    subcategoryIds.length > 0
      ? await service
          .from("subcategories")
          .select("id, category_id, name, slug")
          .in("id", subcategoryIds)
          .eq("is_active", true)
      : { data: [] };

  const categoryById = new Map(
    ((categories ?? []) as FollowedProfessionalCategory[]).map((category) => [
      String(category.id),
      category,
    ]),
  );
  const subcategoryById = new Map(
    ((subcategories ?? []) as FollowedProfessionalSubcategory[]).map((subcategory) => [
      subcategory.id,
      subcategory,
    ]),
  );
  const categoriesByProfessionalId = new Map<string, FollowedProfessionalCategory[]>();

  for (const mapping of mappings ?? []) {
    const category = categoryById.get(String(mapping.category_id));
    if (!category) continue;
    const current = categoriesByProfessionalId.get(mapping.professional_id) ?? [];
    current.push(category);
    categoriesByProfessionalId.set(mapping.professional_id, current);
  }

  return professionals.map((professional) => ({
    ...professional,
    categories: categoriesByProfessionalId.get(professional.id) ?? [],
    subcategory: professional.subcategory_id
      ? (subcategoryById.get(professional.subcategory_id) ?? null)
      : null,
  }));
}

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { data: follows, error: followError } = await supabase
    .from("professional_follows")
    .select("followed_id, created_at")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false });

  if (followError) {
    return NextResponse.json({ error: "Failed to load followed professionals" }, { status: 500 });
  }

  const followedIds = (follows ?? []).map((follow) => follow.followed_id);
  const { data: professionals, error: professionalError } =
    followedIds.length > 0
      ? await supabase
          .from("professional_directory")
          .select("id, first_name, last_name, avatar_url, headline, subcategory_id, province_code")
          .in("id", followedIds)
      : { data: [], error: null };

  if (professionalError) {
    return NextResponse.json({ error: "Failed to load followed professionals" }, { status: 500 });
  }

  const professionalsById = new Map(
    ((professionals ?? []) as FollowedProfessionalRow[]).map((professional) => [
      professional.id,
      professional,
    ]),
  );

  return NextResponse.json({
    followed: await attachTaxonomy(followedIds
      .map((id) => professionalsById.get(id))
      .filter(Boolean) as FollowedProfessionalRow[]),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: FollowPayload;
  try {
    payload = (await request.json()) as FollowPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.followed_id) {
    return NextResponse.json({ error: "followed_id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("professional_follows").insert({
    follower_id: user.id,
    followed_id: payload.followed_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await ensureSocialNotification({
    recipientId: payload.followed_id,
    actorId: user.id,
    type: "follow_started",
    entityType: "professional",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
