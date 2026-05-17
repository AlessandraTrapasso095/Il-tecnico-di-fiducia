import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";

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

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;

  const provinceCode = searchParams.get("province_code");
  const query = searchParams.get("q");
  const categoryIdRaw = searchParams.get("category_id");
  const availableRemote = parseBoolean(searchParams.get("remote"));
  const availableTravel = parseBoolean(searchParams.get("travel"));

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 12, 1, 50);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let professionalIds: string[] | null = null;
  if (categoryIdRaw) {
    const categoryId = Number.parseInt(categoryIdRaw, 10);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
    }

    const { data: mappings, error: mappingError } = await supabase
      .from("professional_categories")
      .select("professional_id")
      .eq("category_id", categoryId);

    if (mappingError) {
      return NextResponse.json(
        { error: "Failed to filter by category" },
        { status: 500 },
      );
    }

    professionalIds = (mappings ?? []).map((m) => m.professional_id);
    if (professionalIds.length === 0) {
      return NextResponse.json({
        page,
        page_size: pageSize,
        total: 0,
        professionals: [],
      });
    }
  }

  let queryBuilder = supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, specializations, avatar_url, available_remote, available_travel",
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

  if (professionalIds) {
    queryBuilder = queryBuilder.in("id", professionalIds);
  }

  if (query && query.trim().length > 0) {
    const q = sanitizeOrSearchQuery(query);
    // Search in a few safe, public fields.
    if (q.length > 0) {
      queryBuilder = queryBuilder.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,headline.ilike.%${q}%`,
      );
    }
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
    professionals: data ?? [],
  });
}
