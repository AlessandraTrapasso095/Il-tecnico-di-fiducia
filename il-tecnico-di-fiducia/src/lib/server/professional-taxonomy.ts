import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfessionalCategoryId = string | number;

export type ProfessionalCategorySelection = {
  id: ProfessionalCategoryId;
  name: string;
  slug: string;
};

export type ProfessionalSubcategorySelection = {
  id: string;
  category_id: ProfessionalCategoryId;
  name: string;
  slug: string;
};

export type ProfessionalTaxonomySelection = {
  category: ProfessionalCategorySelection;
  subcategory: ProfessionalSubcategorySelection | null;
};

type ValidationResult =
  | { ok: true; selection: ProfessionalTaxonomySelection }
  | { ok: false; status: 400 | 500; error: string };

function normalizeCategoryId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return /^\d+$/.test(clean) ? Number.parseInt(clean, 10) : clean;
}

function normalizeSubcategoryId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

export async function validateProfessionalTaxonomySelection(
  supabase: SupabaseClient,
  input: {
    category_id: unknown;
    subcategory_id?: unknown;
  },
): Promise<ValidationResult> {
  const categoryId = normalizeCategoryId(input.category_id);
  if (!categoryId) {
    return { ok: false, status: 400, error: "Seleziona una categoria" };
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    return {
      ok: false,
      status: 500,
      error: "Non è stato possibile verificare la categoria.",
    };
  }

  if (!category) {
    return {
      ok: false,
      status: 400,
      error: "La categoria selezionata non è più disponibile",
    };
  }

  const subcategoryId = normalizeSubcategoryId(input.subcategory_id);
  if (subcategoryId === undefined) {
    return {
      ok: false,
      status: 400,
      error: "La sottocategoria selezionata non è valida.",
    };
  }

  if (!subcategoryId) {
    return {
      ok: true,
      selection: {
        category: category as ProfessionalCategorySelection,
        subcategory: null,
      },
    };
  }

  const { data: subcategory, error: subcategoryError } = await supabase
    .from("subcategories")
    .select("id, category_id, name, slug")
    .eq("id", subcategoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (subcategoryError) {
    return {
      ok: false,
      status: 500,
      error: "Non è stato possibile verificare la sottocategoria.",
    };
  }

  if (!subcategory) {
    return {
      ok: false,
      status: 400,
      error: "La sottocategoria selezionata non è più disponibile.",
    };
  }

  const typedSubcategory = subcategory as ProfessionalSubcategorySelection;
  if (String(typedSubcategory.category_id) !== String(category.id)) {
    return {
      ok: false,
      status: 400,
      error: "La sottocategoria selezionata non appartiene alla categoria",
    };
  }

  return {
    ok: true,
    selection: {
      category: category as ProfessionalCategorySelection,
      subcategory: typedSubcategory,
    },
  };
}
