import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  CATEGORY_SELECT,
  SUBCATEGORY_SELECT,
  hasPayloadError,
  parseSubcategoryPayload,
  subcategorySlugChangeBlockReason,
  type ManagedCategory,
  type ManagedSubcategory,
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
  return "Non è stato possibile aggiornare la sottocategoria.";
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Sottocategoria mancante." }, { status: 400 });

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
  const { data: current, error: currentError } = await service
    .from("subcategories")
    .select(SUBCATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories select before update",
      subcategory_id: id,
      error: currentError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare la sottocategoria." },
      { status: 500 },
    );
  }

  if (!current) {
    return NextResponse.json({ error: "Sottocategoria non trovata." }, { status: 404 });
  }

  const currentSubcategory = current as ManagedSubcategory;
  if (payload.slug !== currentSubcategory.slug) {
    const { data: category, error: categoryError } = await service
      .from("categories")
      .select(CATEGORY_SELECT)
      .eq("id", currentSubcategory.category_id)
      .maybeSingle();

    if (categoryError) {
      logApiError("ADMIN SUBCATEGORIES ERROR", {
        query: "categories select for subcategory slug guard",
        subcategory_id: id,
        error: categoryError,
      });
      return NextResponse.json(
        { error: "Non è stato possibile verificare le dipendenze dello slug." },
        { status: 500 },
      );
    }

    const categorySlug = (category as ManagedCategory | null)?.slug ?? "";
    const reason = subcategorySlugChangeBlockReason(categorySlug, currentSubcategory.slug);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 409 });
    }
  }

  const { data, error } = await service
    .from("subcategories")
    .update(payload)
    .eq("id", id)
    .select(SUBCATEGORY_SELECT)
    .single();

  if (error) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories update",
      subcategory_id: id,
      error,
    });
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: 400 });
  }

  return NextResponse.json({ subcategory: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Sottocategoria mancante." }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("subcategories").delete().eq("id", id);

  if (error) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories delete",
      subcategory_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile eliminare la sottocategoria." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
