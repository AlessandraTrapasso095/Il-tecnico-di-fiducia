import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import { PROFESSION_CATEGORIES } from "@/lib/professions/taxonomy";
import {
  attachProfessionalRatings,
  type ProfessionalWithRating,
} from "@/lib/server/professional-ratings";
import { loadCustomerVisibleProfessionalIds } from "@/lib/server/professional-visibility";

type ProfessionalDirectoryRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  bio: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

type RatedProfessionalDirectoryRow = ProfessionalWithRating<ProfessionalDirectoryRow>;
type CategoryRow = { id: number | null; name: string; slug: string };
type ProfessionalCategoryMappingRow = {
  professional_id: string;
  category_id: number;
};

const MAX_LOCAL_SEARCH_CANDIDATES = 1_000;
const PROVINCE_NAME_BY_CODE = new Map(
  ITALIAN_PROVINCES_BY_NAME.map((province) => [province.code, province.name]),
);

const CATEGORY_ALIASES_BY_SLUG: Record<string, string[]> = {
  ingegneri: ["ingegnere", "ingegnera", "ingegneria", "engineering"],
  architetti: ["architetto", "architetta", "architettura"],
  geometri: ["geometra", "rilievi", "catasto"],
  informatici: [
    "informatico",
    "informatica",
    "programmatore",
    "sviluppatore",
    "developer",
    "software",
    "web developer",
    "it",
  ],
  avvocati: ["avvocato", "avvocata", "legale"],
  elettricisti: ["elettricista", "elettrico", "impianto elettrico"],
  idraulici: ["idraulico", "idraulica", "tubi", "rubinetto"],
  termotecnici: ["termotecnico", "termotecnica", "caldaia", "termosifone"],
  fotovoltaico: ["solare", "pannelli solari", "pannello solare"],
  muratori: ["muratore", "muratura", "edilizia", "cantiere"],
  fabbri: ["fabbro", "serratura", "saldatura", "metallo"],
};

const MIN_ALIAS_LENGTH = 3;

function parseBoolean(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function sanitizeOrSearchQuery(raw: string) {
  return raw
    .replace(/[^\p{L}\p{N}\s.'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function sanitizeSpecialization(raw: string | null) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesSearchText(haystack: string, rawNeedle: string) {
  const needles = expandedSearchNeedles(rawNeedle);
  if (needles.length === 0) return true;

  return needles.some((needle) => {
    if (haystack.includes(needle)) return true;

    const tokens = needle.split(" ").filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
  });
}

function categoryAliases(category: Pick<CategoryRow, "name" | "slug">) {
  const slug = normalizeSearchText(category.slug);
  const name = normalizeSearchText(category.name);
  const aliases = new Set<string>([
    category.name,
    category.slug,
    category.slug.replace(/-/g, " "),
    ...(CATEGORY_ALIASES_BY_SLUG[category.slug] ?? []),
  ]);

  if (name.endsWith("i") && name.length > 3) {
    aliases.add(`${name.slice(0, -1)}o`);
  }

  const catalogCategory = PROFESSION_CATEGORIES.find(
    (catalog) => normalizeSearchText(catalog.slug) === slug,
  );
  if (catalogCategory) {
    aliases.add(catalogCategory.name);
    aliases.add(catalogCategory.slug);
  }

  return [...aliases].filter(Boolean);
}

function expandedSearchNeedles(rawNeedle: string) {
  const needle = normalizeSearchText(rawNeedle);
  if (!needle) return [];

  const needles = new Set<string>([needle]);

  for (const category of PROFESSION_CATEGORIES) {
    const aliases = categoryAliases(category)
      .map(normalizeSearchText)
      .filter((alias) => alias.length >= MIN_ALIAS_LENGTH);

    const matchesAlias = aliases.some(
      (alias) => alias === needle || alias.includes(needle) || needle.includes(alias),
    );

    if (matchesAlias) {
      aliases.forEach((alias) => needles.add(alias));
    }
  }

  return [...needles];
}

function findCatalogCategoryBySlug(slug: string) {
  const normalizedSlug = normalizeSearchText(slug);
  return (
    PROFESSION_CATEGORIES.find(
      (category) => normalizeSearchText(category.slug) === normalizedSlug,
    ) ?? null
  );
}

function rowSearchText(
  row: ProfessionalDirectoryRow,
  categories: CategoryRow[],
) {
  const categoryTerms = categories.flatMap(categoryAliases);
  return normalizeSearchText(
    [
      row.first_name,
      row.last_name,
      row.province_code,
      row.province_code ? PROVINCE_NAME_BY_CODE.get(row.province_code) : null,
      row.headline,
      row.bio,
      ...(row.specializations ?? []),
      ...categoryTerms,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" "),
  );
}

async function loadProfessionalCategoryLookup(
  supabase: SupabaseClient,
  professionalIds: string[],
) {
  const empty = {
    categoriesByProfessionalId: new Map<string, CategoryRow[]>(),
    allCategoriesById: new Map<number, CategoryRow>(),
    mappedProfessionalIds: new Set<string>(),
  };

  if (professionalIds.length === 0) return empty;

  const { data: mappings, error: mappingsError } = await supabase
    .from("professional_categories")
    .select("professional_id, category_id")
    .in("professional_id", professionalIds);

  if (mappingsError || !mappings?.length) return empty;

  const categoryIds = [...new Set(mappings.map((mapping) => mapping.category_id))];
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug")
    .in("id", categoryIds);

  if (categoriesError || !categories?.length) return empty;

  const allCategoriesById = new Map(
    (categories as CategoryRow[]).map((category) => [category.id, category]),
  );
  const categoriesByProfessionalId = new Map<string, CategoryRow[]>();
  const mappedProfessionalIds = new Set<string>();

  for (const mapping of mappings as ProfessionalCategoryMappingRow[]) {
    const category = allCategoriesById.get(mapping.category_id);
    if (!category) continue;
    mappedProfessionalIds.add(mapping.professional_id);
    const existing = categoriesByProfessionalId.get(mapping.professional_id) ?? [];
    existing.push(category);
    categoriesByProfessionalId.set(mapping.professional_id, existing);
  }

  return { categoriesByProfessionalId, allCategoriesById, mappedProfessionalIds };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;

  const provinceCode = searchParams.get("province_code");
  const query = searchParams.get("q");
  const categoryIdRaw = searchParams.get("category_id");
  const categorySlugRaw = searchParams.get("category_slug");
  const subcategory = sanitizeSpecialization(searchParams.get("subcategory"));
  const availableRemote = parseBoolean(searchParams.get("remote"));
  const availableTravel = parseBoolean(searchParams.get("travel"));
  const recommended = searchParams.get("recommended") === "true";
  const customerProvinceCode = searchParams.get("customer_province_code");

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 12, 1, 50);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;
  const q = query && query.trim().length > 0 ? sanitizeOrSearchQuery(query) : "";
  const emptyResponse = {
    page,
    page_size: pageSize,
    total: 0,
    professionals: [],
  };
  const customerVisibleProfessionalIds =
    profile.role === "customer" ? await loadCustomerVisibleProfessionalIds() : null;

  if (customerVisibleProfessionalIds && customerVisibleProfessionalIds.size === 0) {
    return NextResponse.json(emptyResponse);
  }

  let selectedCategory: CategoryRow | null = null;
  let professionalIdsFromCategory: string[] | null = null;
  if (categoryIdRaw) {
    const categoryId = Number.parseInt(categoryIdRaw, 10);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
    }

    const [mappingResult, categoryResult] = await Promise.all([
      supabase
        .from("professional_categories")
        .select("professional_id")
        .eq("category_id", categoryId),
      supabase
        .from("categories")
        .select("id, name, slug")
        .eq("id", categoryId)
        .maybeSingle(),
    ]);

    if (mappingResult.error) {
      return NextResponse.json(
        { error: "Failed to filter by category" },
        { status: 500 },
      );
    }

    if (categoryResult.error) {
      return NextResponse.json(
        { error: "Failed to load category" },
        { status: 500 },
      );
    }

    selectedCategory = (categoryResult.data as CategoryRow | null) ?? null;
    professionalIdsFromCategory =
      (mappingResult.data ?? []).map((m) => m.professional_id) ?? [];
    if (customerVisibleProfessionalIds) {
      professionalIdsFromCategory = professionalIdsFromCategory.filter((id) =>
        customerVisibleProfessionalIds.has(id),
      );
    }
  } else if (categorySlugRaw) {
    const categorySlug = normalizeSearchText(categorySlugRaw).replace(/\s+/g, "-");
    if (categorySlug) {
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, name, slug")
        .eq("slug", categorySlug)
        .maybeSingle();

      if (categoryError) {
        return NextResponse.json(
          { error: "Failed to load category" },
          { status: 500 },
        );
      }

      selectedCategory =
        (categoryData as CategoryRow | null) ?? findCatalogCategoryBySlug(categorySlug);
    }
  }

  let queryBuilder = supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, bio, specializations, avatar_url, available_remote, available_travel",
      { count: "exact" },
    );

  if (provinceCode) {
    queryBuilder = queryBuilder.eq("province_code", provinceCode);
  }

  if (availableRemote === true) {
    queryBuilder = queryBuilder.eq("available_remote", true);
  }

  if (availableTravel === true) {
    queryBuilder = queryBuilder.eq("available_travel", true);
  }

  if (customerVisibleProfessionalIds) {
    const idsForQuery = professionalIdsFromCategory ?? [...customerVisibleProfessionalIds];
    if (idsForQuery.length === 0) {
      return NextResponse.json(emptyResponse);
    }
    queryBuilder = queryBuilder.in("id", idsForQuery);
  }

  const requiresLocalSearch =
    q.length > 0 || selectedCategory !== null || subcategory.length > 0;

  if (!requiresLocalSearch && professionalIdsFromCategory) {
    if (professionalIdsFromCategory.length === 0) {
      return NextResponse.json(emptyResponse);
    }
    if (!customerVisibleProfessionalIds) {
      queryBuilder = queryBuilder.in("id", professionalIdsFromCategory);
    }
  }

  if (requiresLocalSearch) {
    const { data, error } = await queryBuilder
      .order("updated_at", { ascending: false })
      .limit(MAX_LOCAL_SEARCH_CANDIDATES);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load professionals" },
        { status: 500 },
      );
    }

    const candidates = (data ?? []) as ProfessionalDirectoryRow[];
    const candidateIds = candidates.map((professional) => professional.id);
    const { categoriesByProfessionalId } =
      await loadProfessionalCategoryLookup(supabase, candidateIds);
    const categoryIdSet = new Set(professionalIdsFromCategory ?? []);

    const filtered = candidates.filter((professional) => {
      const categories = categoriesByProfessionalId.get(professional.id) ?? [];
      const searchable = rowSearchText(professional, categories);
      const matchesQuery = q.length === 0 || matchesSearchText(searchable, q);
      const matchesCategory =
        !selectedCategory ||
        categoryIdSet.has(professional.id) ||
        categoryAliases(selectedCategory).some((alias) =>
          matchesSearchText(searchable, alias),
        );
      const matchesSubcategory =
        subcategory.length === 0 || matchesSearchText(searchable, subcategory);

      return matchesQuery && matchesCategory && matchesSubcategory;
    });

    const professionals = await attachProfessionalRatings(supabase, filtered);
    const sorted = professionals.sort(
      (a: RatedProfessionalDirectoryRow, b: RatedProfessionalDirectoryRow) => {
        if (recommended) {
          const aProvinceScore =
            customerProvinceCode && a.province_code === customerProvinceCode
              ? 0
              : a.province_code
                ? 1
                : 2;
          const bProvinceScore =
            customerProvinceCode && b.province_code === customerProvinceCode
              ? 0
              : b.province_code
                ? 1
                : 2;
          if (aProvinceScore !== bProvinceScore) return aProvinceScore - bProvinceScore;

          const ratingDelta = (b.rating_average ?? -1) - (a.rating_average ?? -1);
          if (ratingDelta !== 0) return ratingDelta;

          const countDelta = b.reviews_count - a.reviews_count;
          if (countDelta !== 0) return countDelta;
        }

        return `${a.last_name} ${a.first_name}`.localeCompare(
          `${b.last_name} ${b.first_name}`,
          "it",
        );
      },
    );

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: sorted.length,
      professionals: sorted.slice(rangeFrom, rangeTo + 1),
    });
  }

  if (recommended) {
    const { data, error, count } = await queryBuilder
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load professionals" },
        { status: 500 },
      );
    }

    const professionals = await attachProfessionalRatings(
      supabase,
      ((data ?? []) as ProfessionalDirectoryRow[]),
    );

    const sorted = professionals.sort(
      (a: RatedProfessionalDirectoryRow, b: RatedProfessionalDirectoryRow) => {
        const aProvinceScore =
          customerProvinceCode && a.province_code === customerProvinceCode
            ? 0
            : a.province_code
              ? 1
              : 2;
        const bProvinceScore =
          customerProvinceCode && b.province_code === customerProvinceCode
            ? 0
            : b.province_code
              ? 1
              : 2;
        if (aProvinceScore !== bProvinceScore) return aProvinceScore - bProvinceScore;

        const ratingDelta = (b.rating_average ?? -1) - (a.rating_average ?? -1);
        if (ratingDelta !== 0) return ratingDelta;

        const countDelta = b.reviews_count - a.reviews_count;
        if (countDelta !== 0) return countDelta;

        return `${a.last_name} ${a.first_name}`.localeCompare(
          `${b.last_name} ${b.first_name}`,
          "it",
        );
      },
    );

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: count ?? sorted.length,
      professionals: sorted.slice(rangeFrom, rangeTo + 1),
    });
  }

  const { data, error, count } = await queryBuilder
    .order("updated_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load professionals" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    professionals: await attachProfessionalRatings(
      supabase,
      ((data ?? []) as ProfessionalDirectoryRow[]),
    ),
  });
}
