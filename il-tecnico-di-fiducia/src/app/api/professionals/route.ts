import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import { logApiError } from "@/lib/server/api-logger";
import {
  attachProfessionalRatings,
  type ProfessionalWithRating,
} from "@/lib/server/professional-ratings";
import { loadCustomerVisibleProfessionalIds } from "@/lib/server/professional-visibility";
import { createServiceClient } from "@/lib/supabase/service";

type ProfessionalDirectoryRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  bio: string | null;
  specializations: string[] | null;
  subcategory_id?: string | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

type CategoryId = number | string;
type CategoryRow = { id: CategoryId | null; name: string; slug: string };
type SubcategoryRow = {
  id: string;
  category_id: CategoryId;
  name: string;
  slug: string;
};
type ProfessionalDirectoryRowWithTaxonomy = ProfessionalDirectoryRow & {
  categories?: CategoryRow[];
  subcategory?: SubcategoryRow | null;
};
type RatedProfessionalDirectoryRow = ProfessionalWithRating<ProfessionalDirectoryRowWithTaxonomy>;
type ProfessionalCategoryMappingRow = {
  professional_id: string;
  category_id: CategoryId;
};

const MAX_LOCAL_SEARCH_CANDIDATES = 1_000;
const PROVINCE_NAME_BY_CODE = new Map(
  ITALIAN_PROVINCES_BY_NAME.map((province) => [province.code, province.name]),
);

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

function matchesSubcategoryText(haystack: string, rawNeedle: string) {
  const needle = normalizeSearchText(rawNeedle);
  if (!needle) return true;
  if (matchesSearchText(haystack, needle)) return true;

  const tokens = needle.split(" ").filter((token) => token.length >= MIN_ALIAS_LENGTH);
  return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
}

function categoryAliases(category: Pick<CategoryRow, "name" | "slug">) {
  const name = normalizeSearchText(category.name);
  const aliases = new Set<string>([
    category.name,
    category.slug,
    category.slug.replace(/-/g, " "),
  ]);

  if (name.endsWith("i") && name.length > 3) {
    aliases.add(`${name.slice(0, -1)}o`);
  }

  return [...aliases].filter(Boolean);
}

function expandedSearchNeedles(rawNeedle: string) {
  const needle = normalizeSearchText(rawNeedle);
  if (!needle) return [];

  const needles = new Set<string>([needle]);
  for (const token of needle.split(" ")) {
    if (token.length > MIN_ALIAS_LENGTH + 1) {
      needles.add(token.slice(0, -1));
    }
  }
  if (needle.length > MIN_ALIAS_LENGTH + 1) {
    needles.add(needle.slice(0, -1));
  }

  return [...needles];
}

function rowSearchText(
  row: ProfessionalDirectoryRow,
  categories: CategoryRow[],
  subcategory?: SubcategoryRow | null,
) {
  const categoryTerms = categories.flatMap(categoryAliases);
  return normalizeSearchText(
    [
      row.first_name,
      row.last_name,
      row.province_code,
      row.province_code ? PROVINCE_NAME_BY_CODE.get(row.province_code) : null,
      row.bio,
      ...categoryTerms,
      subcategory?.name,
      subcategory?.slug,
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
  };

  if (professionalIds.length === 0) return empty;

  const { data: mappings, error: mappingsError } = await supabase
    .from("professional_categories")
    .select("professional_id, category_id")
    .in("professional_id", professionalIds);

  if (mappingsError) {
    logApiError("PROFESSIONALS ERROR", {
      query: "professional_categories select by professional ids",
      error: mappingsError,
    });
    return empty;
  }

  if (!mappings?.length) return empty;

  const categoryIds = [...new Set(mappings.map((mapping) => mapping.category_id))];
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug")
    .in("id", categoryIds)
    .eq("is_active", true);

  if (categoriesError) {
    logApiError("PROFESSIONALS ERROR", {
      query: "categories select active by professional category ids",
      error: categoriesError,
    });
    return empty;
  }

  if (!categories?.length) return empty;

  const categoriesById = new Map(
    (categories as CategoryRow[]).map((category) => [category.id, category]),
  );
  const categoriesByProfessionalId = new Map<string, CategoryRow[]>();

  for (const mapping of mappings as ProfessionalCategoryMappingRow[]) {
    const category = categoriesById.get(mapping.category_id);
    if (!category) continue;
    const existing = categoriesByProfessionalId.get(mapping.professional_id) ?? [];
    existing.push(category);
    categoriesByProfessionalId.set(mapping.professional_id, existing);
  }

  return { categoriesByProfessionalId };
}

async function loadProfessionalSubcategoryLookup(
  supabase: SupabaseClient,
  professionals: ProfessionalDirectoryRow[],
) {
  const subcategoryIds = [
    ...new Set(
      professionals
        .map((professional) => professional.subcategory_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const subcategoriesByProfessionalId = new Map<string, SubcategoryRow | null>();

  if (subcategoryIds.length === 0) return { subcategoriesByProfessionalId };

  const { data: subcategories, error } = await supabase
    .from("subcategories")
    .select("id, category_id, name, slug")
    .in("id", subcategoryIds)
    .eq("is_active", true);

  if (error) {
    logApiError("PROFESSIONALS ERROR", {
      query: "subcategories select active by professional subcategory ids",
      error,
    });
    return { subcategoriesByProfessionalId };
  }

  const subcategoriesById = new Map(
    ((subcategories ?? []) as SubcategoryRow[]).map((subcategory) => [
      subcategory.id,
      subcategory,
    ]),
  );

  for (const professional of professionals) {
    subcategoriesByProfessionalId.set(
      professional.id,
      professional.subcategory_id
        ? (subcategoriesById.get(professional.subcategory_id) ?? null)
        : null,
    );
  }

  return { subcategoriesByProfessionalId };
}

function attachTaxonomyToProfessionals(
  professionals: ProfessionalDirectoryRow[],
  categoriesByProfessionalId: Map<string, CategoryRow[]>,
  subcategoriesByProfessionalId: Map<string, SubcategoryRow | null>,
): ProfessionalDirectoryRowWithTaxonomy[] {
  return professionals.map((professional) => ({
    ...professional,
    categories: categoriesByProfessionalId.get(professional.id) ?? [],
    subcategory: subcategoriesByProfessionalId.get(professional.id) ?? null,
  }));
}

async function loadProfessionalIdsForCategory(
  supabase: SupabaseClient,
  categoryId: CategoryId,
) {
  const { data, error } = await supabase
    .from("professional_categories")
    .select("professional_id")
    .eq("category_id", categoryId);

  if (error) {
    logApiError("PROFESSIONALS ERROR", {
      query: "professional_categories select professional_id by active category",
      category_id: categoryId,
      error,
    });
    throw error;
  }

  return (data ?? []).map((mapping) => mapping.professional_id);
}

async function loadProfessionalIdsForSubcategory(
  supabase: SupabaseClient,
  subcategoryId: string,
) {
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("subcategory_id", subcategoryId);

  if (error) {
    logApiError("PROFESSIONALS ERROR", {
      query: "professional_profiles select id by active subcategory",
      subcategory_id: subcategoryId,
      error,
    });
    throw error;
  }

  return (data ?? []).map((professional) => professional.id);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { supabase, profile } = auth.ctx;
    const isCustomerSearch = profile.role === "customer";
    const dataClient = isCustomerSearch ? createServiceClient() : supabase;

    const searchParams = request.nextUrl.searchParams;

    const provinceCode = searchParams.get("province_code");
    const query = searchParams.get("q");
    const categoryIdRaw = searchParams.get("category_id");
    const categorySlugRaw = searchParams.get("category_slug");
    const subcategoryIdRaw = searchParams.get("subcategory_id");
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
    const customerVisibleProfessionalIds = isCustomerSearch
      ? await loadCustomerVisibleProfessionalIds(undefined, dataClient)
      : null;

    if (customerVisibleProfessionalIds && customerVisibleProfessionalIds.size === 0) {
      return NextResponse.json(emptyResponse);
    }

    let selectedCategory: CategoryRow | null = null;
    let professionalIdsFromCategory: string[] | null = null;
    let selectedSubcategory: SubcategoryRow | null = null;
    let professionalIdsFromSubcategory: string[] | null = null;
    if (categoryIdRaw) {
      const categoryId = /^\d+$/.test(categoryIdRaw)
        ? Number.parseInt(categoryIdRaw, 10)
        : categoryIdRaw.trim();
      if (!categoryId) {
        return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
      }

      const categoryResult = await dataClient
        .from("categories")
        .select("id, name, slug")
        .eq("id", categoryId)
        .eq("is_active", true)
        .maybeSingle();

      if (categoryResult.error) {
        logApiError("PROFESSIONALS ERROR", {
          user_id: auth.ctx.user.id,
          role: profile.role,
          query: "categories select active id, name, slug by id",
          category_id: categoryId,
          error: categoryResult.error,
        });
        return NextResponse.json(
          { error: "Non è stato possibile caricare la categoria." },
          { status: 500 },
        );
      }

      selectedCategory = (categoryResult.data as CategoryRow | null) ?? null;
      if (!selectedCategory) {
        return NextResponse.json(emptyResponse);
      }

      try {
        professionalIdsFromCategory = await loadProfessionalIdsForCategory(
          dataClient,
          selectedCategory.id ?? categoryId,
        );
      } catch {
        return NextResponse.json(
          { error: "Non è stato possibile filtrare per categoria." },
          { status: 500 },
        );
      }
      if (customerVisibleProfessionalIds) {
        professionalIdsFromCategory = professionalIdsFromCategory.filter((id) =>
          customerVisibleProfessionalIds.has(id),
        );
      }
    } else if (categorySlugRaw) {
      const categorySlug = normalizeSearchText(categorySlugRaw).replace(/\s+/g, "-");
      if (categorySlug) {
        const { data: categoryData, error: categoryError } = await dataClient
          .from("categories")
          .select("id, name, slug")
          .eq("slug", categorySlug)
          .eq("is_active", true)
          .maybeSingle();

        if (categoryError) {
          logApiError("PROFESSIONALS ERROR", {
            user_id: auth.ctx.user.id,
            role: profile.role,
            query: "categories select active id, name, slug by slug",
            category_slug: categorySlug,
            error: categoryError,
          });
          return NextResponse.json(
            { error: "Non è stato possibile caricare la categoria." },
            { status: 500 },
          );
        }

        selectedCategory = (categoryData as CategoryRow | null) ?? null;
        if (!selectedCategory) {
          return NextResponse.json(emptyResponse);
        }

        try {
          professionalIdsFromCategory = await loadProfessionalIdsForCategory(
            dataClient,
            selectedCategory.id ?? categorySlug,
          );
        } catch {
          return NextResponse.json(
            { error: "Non è stato possibile filtrare per categoria." },
            { status: 500 },
          );
        }
        if (customerVisibleProfessionalIds) {
          professionalIdsFromCategory = professionalIdsFromCategory.filter((id) =>
            customerVisibleProfessionalIds.has(id),
          );
        }
      }
    }

    if (subcategoryIdRaw) {
      const subcategoryId = subcategoryIdRaw.trim();
      if (!subcategoryId) {
        return NextResponse.json({ error: "Invalid subcategory_id" }, { status: 400 });
      }

      const { data: subcategoryData, error: subcategoryError } = await dataClient
        .from("subcategories")
        .select("id, category_id, name, slug")
        .eq("id", subcategoryId)
        .eq("is_active", true)
        .maybeSingle();

      if (subcategoryError) {
        logApiError("PROFESSIONALS ERROR", {
          user_id: auth.ctx.user.id,
          role: profile.role,
          query: "subcategories select active id, category_id, name, slug by id",
          subcategory_id: subcategoryId,
          error: subcategoryError,
        });
        return NextResponse.json(
          { error: "Non è stato possibile caricare la sottocategoria." },
          { status: 500 },
        );
      }

      selectedSubcategory = (subcategoryData as SubcategoryRow | null) ?? null;
      if (!selectedSubcategory) {
        return NextResponse.json(emptyResponse);
      }

      if (!selectedCategory) {
        const { data: parentCategory, error: parentCategoryError } = await dataClient
          .from("categories")
          .select("id, name, slug")
          .eq("id", selectedSubcategory.category_id)
          .eq("is_active", true)
          .maybeSingle();

        if (parentCategoryError) {
          logApiError("PROFESSIONALS ERROR", {
            user_id: auth.ctx.user.id,
            role: profile.role,
            query: "categories select active parent by subcategory",
            subcategory_id: selectedSubcategory.id,
            error: parentCategoryError,
          });
          return NextResponse.json(
            { error: "Non è stato possibile caricare la categoria." },
            { status: 500 },
          );
        }

        selectedCategory = (parentCategory as CategoryRow | null) ?? null;
        if (!selectedCategory) {
          return NextResponse.json(emptyResponse);
        }
      }

      if (
        selectedCategory &&
        String(selectedSubcategory.category_id) !== String(selectedCategory.id)
      ) {
        return NextResponse.json(emptyResponse);
      }

      try {
        professionalIdsFromSubcategory = await loadProfessionalIdsForSubcategory(
          dataClient,
          selectedSubcategory.id,
        );
      } catch {
        return NextResponse.json(
          { error: "Non è stato possibile filtrare per sottocategoria." },
          { status: 500 },
        );
      }

      if (professionalIdsFromCategory) {
        const categorySet = new Set(professionalIdsFromCategory);
        professionalIdsFromSubcategory = professionalIdsFromSubcategory.filter((id) =>
          categorySet.has(id),
        );
      }

      if (customerVisibleProfessionalIds) {
        professionalIdsFromSubcategory = professionalIdsFromSubcategory.filter((id) =>
          customerVisibleProfessionalIds.has(id),
        );
      }
    }

    if (professionalIdsFromCategory && professionalIdsFromCategory.length === 0) {
      return NextResponse.json(emptyResponse);
    }

    if (professionalIdsFromSubcategory && professionalIdsFromSubcategory.length === 0) {
      return NextResponse.json(emptyResponse);
    }

    let queryBuilder = dataClient
      .from("professional_directory")
      .select(
        "id, first_name, last_name, province_code, headline, bio, specializations, subcategory_id, avatar_url, available_remote, available_travel",
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
      const idsForQuery =
        professionalIdsFromSubcategory && professionalIdsFromSubcategory.length > 0
          ? professionalIdsFromSubcategory
          : professionalIdsFromCategory && professionalIdsFromCategory.length > 0
          ? professionalIdsFromCategory
          : [...customerVisibleProfessionalIds];
      if (idsForQuery.length === 0) {
        return NextResponse.json(emptyResponse);
      }
      queryBuilder = queryBuilder.in("id", idsForQuery);
    }

    const requiresLocalSearch =
      q.length > 0 ||
      selectedCategory !== null ||
      selectedSubcategory !== null ||
      subcategory.length > 0;

    const idsFromTaxonomy = professionalIdsFromSubcategory ?? professionalIdsFromCategory;

    if (!requiresLocalSearch && idsFromTaxonomy) {
      if (idsFromTaxonomy.length === 0) {
        return NextResponse.json(emptyResponse);
      }
      if (!customerVisibleProfessionalIds) {
        queryBuilder = queryBuilder.in("id", idsFromTaxonomy);
      }
    }

    if (requiresLocalSearch) {
      const { data, error } = await queryBuilder
        .order("updated_at", { ascending: false })
        .limit(MAX_LOCAL_SEARCH_CANDIDATES);

      if (error) {
        logApiError("PROFESSIONALS ERROR", {
          user_id: auth.ctx.user.id,
          role: profile.role,
          query: "professional_directory local search candidates",
          search: request.nextUrl.search,
          error,
        });
        return NextResponse.json(
          { error: "Non è stato possibile caricare i professionisti. Riprova." },
          { status: 500 },
        );
      }

      const candidates = (data ?? []) as ProfessionalDirectoryRow[];
      const candidateIds = candidates.map((professional) => professional.id);
      const { categoriesByProfessionalId } =
        await loadProfessionalCategoryLookup(dataClient, candidateIds);
      const { subcategoriesByProfessionalId } =
        await loadProfessionalSubcategoryLookup(dataClient, candidates);
      const categoryIdSet = new Set(professionalIdsFromCategory ?? []);
      const subcategoryIdSet = new Set(professionalIdsFromSubcategory ?? []);

      const filtered = candidates.filter((professional) => {
        const categories = categoriesByProfessionalId.get(professional.id) ?? [];
        const professionalSubcategory =
          subcategoriesByProfessionalId.get(professional.id) ?? null;
        const searchable = rowSearchText(professional, categories, professionalSubcategory);
        const matchesQuery = q.length === 0 || matchesSearchText(searchable, q);
        const matchesCategory =
          !selectedCategory ||
          categoryIdSet.has(professional.id) ||
          categoryAliases(selectedCategory).some((alias) =>
              matchesSearchText(searchable, alias),
          );
        const matchesSubcategory =
          (!selectedSubcategory || subcategoryIdSet.has(professional.id)) &&
          (subcategory.length === 0 || matchesSubcategoryText(searchable, subcategory));

        return matchesQuery && matchesCategory && matchesSubcategory;
      });

      const professionals = await attachProfessionalRatings(
        dataClient,
        attachTaxonomyToProfessionals(
          filtered,
          categoriesByProfessionalId,
          subcategoriesByProfessionalId,
        ),
      );
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
            if (aProvinceScore !== bProvinceScore) {
              return aProvinceScore - bProvinceScore;
            }

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
      const { data, error } = await queryBuilder
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) {
        logApiError("PROFESSIONALS ERROR", {
          user_id: auth.ctx.user.id,
          role: profile.role,
          query: "professional_directory recommended",
          search: request.nextUrl.search,
          error,
        });
        return NextResponse.json(
          { error: "Non è stato possibile caricare i professionisti. Riprova." },
          { status: 500 },
        );
      }

      const recommendedRows = (data ?? []) as ProfessionalDirectoryRow[];
      const recommendedIds = recommendedRows.map((professional) => professional.id);
      const { categoriesByProfessionalId } =
        await loadProfessionalCategoryLookup(dataClient, recommendedIds);
      const { subcategoriesByProfessionalId } =
        await loadProfessionalSubcategoryLookup(dataClient, recommendedRows);
      const professionals = await attachProfessionalRatings(
        dataClient,
        attachTaxonomyToProfessionals(
          recommendedRows,
          categoriesByProfessionalId,
          subcategoriesByProfessionalId,
        ),
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
        total: sorted.length,
        professionals: sorted.slice(rangeFrom, rangeTo + 1),
      });
    }

    const { data, error, count } = await queryBuilder
      .order("updated_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (error) {
      logApiError("PROFESSIONALS ERROR", {
        user_id: auth.ctx.user.id,
        role: profile.role,
        query: "professional_directory paginated",
        search: request.nextUrl.search,
        error,
      });
      return NextResponse.json(
        { error: "Non è stato possibile caricare i professionisti. Riprova." },
        { status: 500 },
      );
    }

    const paginatedRows = (data ?? []) as ProfessionalDirectoryRow[];
    const paginatedIds = paginatedRows.map((professional) => professional.id);
    const { categoriesByProfessionalId } =
      await loadProfessionalCategoryLookup(dataClient, paginatedIds);
    const { subcategoriesByProfessionalId } =
      await loadProfessionalSubcategoryLookup(dataClient, paginatedRows);

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: count ?? 0,
      professionals: await attachProfessionalRatings(
        dataClient,
        attachTaxonomyToProfessionals(
          paginatedRows,
          categoriesByProfessionalId,
          subcategoriesByProfessionalId,
        ),
      ),
    });
  } catch (error) {
    logApiError("PROFESSIONALS ERROR", {
      query: "GET /api/professionals",
      search: request.nextUrl.search,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare i professionisti. Riprova." },
      { status: 500 },
    );
  }
}
