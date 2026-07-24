import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { attachProfessionalRatings } from "@/lib/server/professional-ratings";
import {
  isProfessionalVisibleToCustomers,
  loadCustomerVisibleProfessionalIds,
} from "@/lib/server/professional-visibility";
import { createServiceClient } from "@/lib/supabase/service";

type SavePayload = {
  professional_id: string;
};

type SavedProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  specializations: string[] | null;
  subcategory_id?: string | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

type CategoryId = string | number;

type SavedProfessionalCategory = {
  id: CategoryId | null;
  name: string;
  slug: string;
};

type SavedProfessionalSubcategory = {
  id: string;
  category_id: CategoryId;
  name: string;
  slug: string;
};

type SavedProfessionalWithTaxonomy = SavedProfessionalRow & {
  categories?: SavedProfessionalCategory[];
  subcategory?: SavedProfessionalSubcategory | null;
};

async function attachTaxonomy(professionals: SavedProfessionalRow[]) {
  if (professionals.length === 0) return [] as SavedProfessionalWithTaxonomy[];

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
    ((categories ?? []) as SavedProfessionalCategory[]).map((category) => [
      String(category.id),
      category,
    ]),
  );
  const subcategoryById = new Map(
    ((subcategories ?? []) as SavedProfessionalSubcategory[]).map((subcategory) => [
      subcategory.id,
      subcategory,
    ]),
  );
  const categoriesByProfessionalId = new Map<string, SavedProfessionalCategory[]>();

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
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { data: rows, error } = await supabase
    .from("saved_professionals")
    .select("professional_id, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load saved professionals" },
      { status: 500 },
    );
  }

  const ids = (rows ?? []).map((r) => r.professional_id);
  if (ids.length === 0) {
    return NextResponse.json({ professionals: [] });
  }

  const visibleIds = await loadCustomerVisibleProfessionalIds(ids);
  const visibleOrderedIds = ids.filter((id) => visibleIds.has(id));
  if (visibleOrderedIds.length === 0) {
    return NextResponse.json({ professionals: [] });
  }

  const { data: professionals, error: professionalsError } = await supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, specializations, subcategory_id, avatar_url, available_remote, available_travel",
    )
    .in("id", visibleOrderedIds);

  if (professionalsError) {
    return NextResponse.json(
      { error: "Failed to load professionals" },
      { status: 500 },
    );
  }

  const byId = new Map(
    ((professionals ?? []) as SavedProfessionalRow[]).map((professional) => [
      professional.id,
      professional,
    ]),
  );
  const orderedProfessionals = visibleOrderedIds
    .map((id) => byId.get(id))
    .filter((professional): professional is SavedProfessionalRow => Boolean(professional));
  const professionalsWithTaxonomy = await attachTaxonomy(orderedProfessionals);

  return NextResponse.json({
    professionals: await attachProfessionalRatings(supabase, professionalsWithTaxonomy),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: SavePayload;
  try {
    payload = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.professional_id) {
    return NextResponse.json(
      { error: "professional_id is required" },
      { status: 400 },
    );
  }

  if (!(await isProfessionalVisibleToCustomers(payload.professional_id))) {
    return NextResponse.json(
      { error: "Professional is not available" },
      { status: 403 },
    );
  }

  const { error } = await supabase.from("saved_professionals").upsert(
    {
      customer_id: user.id,
      professional_id: payload.professional_id,
    },
    // Bookmarks are idempotent: if the row already exists, ignore the duplicate
    // instead of requiring UPDATE permissions/RLS (least-privilege).
    { onConflict: "customer_id,professional_id", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
