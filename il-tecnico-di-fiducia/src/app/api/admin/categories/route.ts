import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  CATEGORY_SELECT,
  hasPayloadError,
  parseCategoryPayload,
  revalidateCategoryCatalog,
  SUBCATEGORY_SELECT,
  type ManagedCategory,
  type ManagedSubcategory,
} from "@/lib/server/category-management";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

function publicDatabaseError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return "Esiste già una categoria con questo slug.";
  return "Non è stato possibile completare l’operazione.";
}

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const service = createServiceClient();
  const [{ data: categories, error: categoriesError }, { data: subcategories, error: subcategoriesError }] =
    await Promise.all([
      service.from("categories").select(CATEGORY_SELECT).order("sort_order", { ascending: true }).order("name"),
      service
        .from("subcategories")
        .select(SUBCATEGORY_SELECT)
        .order("sort_order", { ascending: true })
        .order("name"),
    ]);

  if (categoriesError || subcategoriesError) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "GET /api/admin/categories",
      error: categoriesError ?? subcategoriesError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare categorie e sottocategorie." },
      { status: 500 },
    );
  }

  const subcategoriesByCategory = new Map<string, ManagedSubcategory[]>();
  for (const subcategory of (subcategories ?? []) as ManagedSubcategory[]) {
    const key = String(subcategory.category_id);
    const current = subcategoriesByCategory.get(key) ?? [];
    current.push(subcategory);
    subcategoriesByCategory.set(key, current);
  }

  const result = ((categories ?? []) as ManagedCategory[]).map((category) => ({
    ...category,
    subcategories: subcategoriesByCategory.get(String(category.id)) ?? [],
  }));

  return NextResponse.json({ categories: result });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const payload = parseCategoryPayload(body);
  if (hasPayloadError(payload)) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("categories")
    .insert(payload)
    .select(CATEGORY_SELECT)
    .single();

  if (error) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "categories insert",
      error,
      slug: payload.slug,
    });
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: 400 });
  }

  revalidateCategoryCatalog();

  return NextResponse.json({ category: data }, { status: 201 });
}
