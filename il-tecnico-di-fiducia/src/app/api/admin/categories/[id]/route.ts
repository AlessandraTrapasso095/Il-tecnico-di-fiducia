import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  CATEGORY_SELECT,
  categorySlugChangeBlockReason,
  hasPayloadError,
  parseCategoryPayload,
  type ManagedCategory,
} from "@/lib/server/category-management";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function publicDatabaseError(error: { code?: string } | null) {
  if (error?.code === "23505") return "Esiste già una categoria con questo slug.";
  return "Non è stato possibile aggiornare la categoria.";
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const payload = parseCategoryPayload(body);
  if (hasPayloadError(payload)) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: current, error: currentError } = await service
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "categories select before update",
      category_id: id,
      error: currentError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare la categoria." },
      { status: 500 },
    );
  }

  if (!current) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const currentCategory = current as ManagedCategory;
  if (payload.slug !== currentCategory.slug) {
    const reason = await categorySlugChangeBlockReason(service, currentCategory);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 409 });
    }
  }

  const { data, error } = await service
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select(CATEGORY_SELECT)
    .single();

  if (error) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "categories update",
      category_id: id,
      error,
    });
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: 400 });
  }

  return NextResponse.json({ category: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Categoria mancante." }, { status: 400 });

  const service = createServiceClient();
  const [{ count: professionalCount }, { count: subcategoryCount }] = await Promise.all([
    service
      .from("professional_categories")
      .select("professional_id", { count: "exact", head: true })
      .eq("category_id", id),
    service
      .from("subcategories")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id),
  ]);

  if ((professionalCount ?? 0) > 0 || (subcategoryCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Cancellazione fisica bloccata: disattiva la categoria per preservare profili e sottocategorie esistenti.",
      },
      { status: 409 },
    );
  }

  const { error } = await service.from("categories").delete().eq("id", id);
  if (error) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "categories delete",
      category_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile eliminare la categoria." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
