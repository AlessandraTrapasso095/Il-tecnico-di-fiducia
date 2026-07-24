import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";

import { PROFESSION_CATEGORIES } from "@/lib/professions/taxonomy";

export type CategoryId = string | number;

export type ManagedSubcategory = {
  id: string;
  category_id: CategoryId;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ManagedCategory = {
  id: CategoryId;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  professional_count?: number;
  subcategories?: ManagedSubcategory[];
};

export type CategoryPayload = {
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type SubcategoryPayload = {
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export const CATEGORY_SELECT =
  "id, name, slug, description, image_url, icon, sort_order, is_active, created_at, updated_at";

export const SUBCATEGORY_SELECT =
  "id, category_id, name, slug, sort_order, is_active, created_at, updated_at";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const catalogCategorySlugs = new Set(PROFESSION_CATEGORIES.map((category) => category.slug));
const catalogSubcategorySlugsByCategory = new Map(
  PROFESSION_CATEGORIES.map((category) => [
    category.slug,
    new Set(category.subcategories.map((subcategory) => subcategory.slug)),
  ]),
);

function compactText(value: unknown, maxLength: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

export function normalizeSlug(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function isValidSlug(slug: string) {
  return slugPattern.test(slug);
}

export function parseSortOrder(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(parsed)));
}

export function revalidateCategoryCatalog() {
  revalidateTag("profession-categories", { expire: 0 });
  [
    "/",
    "/api/categories",
    "/auth/register",
    "/cliente",
    "/customer",
    "/professional",
    "/professionista",
    "/professionista/profilo",
    "/admin",
    "/admin/categorie",
  ].forEach((path) => revalidatePath(path));
}

export function parseCategoryPayload(value: unknown): CategoryPayload | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Payload non valido." };
  }

  const record = value as Record<string, unknown>;
  const name = compactText(record.name, 120);
  if (!name) return { error: "Il nome è obbligatorio." };

  const slug = normalizeSlug(record.slug || name);
  if (!slug || !isValidSlug(slug)) {
    return { error: "Lo slug deve contenere solo lettere, numeri e trattini." };
  }

  const sortOrder = parseSortOrder(record.sort_order);
  if (sortOrder === null) return { error: "L’ordine deve essere un numero valido." };

  return {
    name,
    slug,
    description: compactText(record.description, 600) ?? null,
    image_url: compactText(record.image_url, 800) ?? null,
    icon: compactText(record.icon, 80) ?? null,
    sort_order: sortOrder,
    is_active: typeof record.is_active === "boolean" ? record.is_active : true,
  };
}

export function parseSubcategoryPayload(value: unknown): SubcategoryPayload | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Payload non valido." };
  }

  const record = value as Record<string, unknown>;
  const name = compactText(record.name, 120);
  if (!name) return { error: "Il nome è obbligatorio." };

  const slug = normalizeSlug(record.slug || name);
  if (!slug || !isValidSlug(slug)) {
    return { error: "Lo slug deve contenere solo lettere, numeri e trattini." };
  }

  const sortOrder = parseSortOrder(record.sort_order);
  if (sortOrder === null) return { error: "L’ordine deve essere un numero valido." };

  return {
    name,
    slug,
    sort_order: sortOrder,
    is_active: typeof record.is_active === "boolean" ? record.is_active : true,
  };
}

export function hasPayloadError<T>(payload: T | { error: string }): payload is { error: string } {
  return typeof payload === "object" && payload !== null && "error" in payload;
}

export async function categorySlugChangeBlockReason(
  supabase: SupabaseClient,
  category: Pick<ManagedCategory, "id" | "slug">,
) {
  if (catalogCategorySlugs.has(category.slug)) {
    return "Questa categoria fa parte del catalogo pubblico attuale: in questa fase lo slug non può essere modificato.";
  }

  const [{ count: professionalCount }, { count: subcategoryCount }] = await Promise.all([
    supabase
      .from("professional_categories")
      .select("professional_id", { count: "exact", head: true })
      .eq("category_id", category.id),
    supabase
      .from("subcategories")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id),
  ]);

  if ((professionalCount ?? 0) > 0) {
    return "Esistono professionisti associati a questa categoria: modifica slug bloccata per sicurezza.";
  }

  if ((subcategoryCount ?? 0) > 0) {
    return "Esistono sottocategorie associate: modifica slug bloccata per sicurezza.";
  }

  return null;
}

export function subcategorySlugChangeBlockReason(
  categorySlug: string,
  subcategorySlug: string,
) {
  const catalogSlugs = catalogSubcategorySlugsByCategory.get(categorySlug);
  if (catalogSlugs?.has(subcategorySlug)) {
    return "Questa sottocategoria fa parte del catalogo pubblico attuale: in questa fase lo slug non può essere modificato.";
  }

  return null;
}
