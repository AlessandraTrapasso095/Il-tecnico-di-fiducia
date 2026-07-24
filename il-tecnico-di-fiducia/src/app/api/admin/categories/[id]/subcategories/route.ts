import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  SUBCATEGORY_SELECT,
  hasPayloadError,
  parseSubcategoryPayload,
} from "@/lib/server/category-management";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function publicDatabaseError(error: { code?: string } | null) {
  if (error?.code === "23505") {
    return "Esiste già una sottocategoria con questo slug nella categoria selezionata.";
  }
  return "Non è stato possibile completare l’operazione.";
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Categoria mancante." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("subcategories")
    .select(SUBCATEGORY_SELECT)
    .eq("category_id", id)
    .order("sort_order", { ascending: true })
    .order("name");

  if (error) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories select by category",
      category_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare le sottocategorie." },
      { status: 500 },
    );
  }

  return NextResponse.json({ subcategories: data ?? [] });
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Categoria mancante." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const payload = parseSubcategoryPayload(body);
  if (hasPayloadError(payload)) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: category } = await service.from("categories").select("id").eq("id", id).maybeSingle();
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const { data, error } = await service
    .from("subcategories")
    .insert({ ...payload, category_id: id })
    .select(SUBCATEGORY_SELECT)
    .single();

  if (error) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories insert",
      category_id: id,
      error,
    });
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: 400 });
  }

  return NextResponse.json({ subcategory: data }, { status: 201 });
}
