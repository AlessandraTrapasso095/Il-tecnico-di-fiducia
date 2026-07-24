import { NextResponse } from "next/server";

import { logApiError } from "@/lib/server/api-logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();

    const query =
      "categories select id, name, slug, description, image_url, icon, sort_order, is_active order sort_order/name";
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, image_url, icon, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      logApiError("CATEGORIES ERROR", {
        query,
        error,
      });
      return NextResponse.json(
        { categories: [], error: "Non è stato possibile caricare le categorie." },
        { status: 503 },
      );
    }

    const categoryIds = (data ?? []).map((category) => category.id).filter(Boolean);
    const { data: subcategories, error: subcategoriesError } =
      categoryIds.length > 0
        ? await supabase
            .from("subcategories")
            .select("id, category_id, name, slug, sort_order, is_active")
            .in("category_id", categoryIds)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
        : { data: [], error: null };

    if (subcategoriesError) {
      logApiError("CATEGORIES ERROR", {
        query: "subcategories select active by category ids",
        error: subcategoriesError,
      });
      return NextResponse.json(
        { categories: [], error: "Non è stato possibile caricare le sottocategorie." },
        { status: 503 },
      );
    }

    const subcategoriesByCategory = new Map<string, unknown[]>();
    for (const subcategory of subcategories ?? []) {
      const record = subcategory as { category_id: unknown };
      const key = String(record.category_id);
      const current = subcategoriesByCategory.get(key) ?? [];
      current.push(subcategory);
      subcategoriesByCategory.set(key, current);
    }

    return NextResponse.json({
      categories: (data ?? []).map((category) => ({
        ...category,
        subcategories: subcategoriesByCategory.get(String(category.id)) ?? [],
      })),
    });
  } catch (error) {
    logApiError("CATEGORIES ERROR", {
      query: "GET /api/categories",
      error,
    });
    return NextResponse.json(
      { categories: [], error: "Non è stato possibile caricare le categorie." },
      { status: 503 },
    );
  }
}
