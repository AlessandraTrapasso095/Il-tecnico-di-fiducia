import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { parseSortOrder, revalidateCategoryCatalog } from "@/lib/server/category-management";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReorderItem = {
  id: string;
  sort_order: number;
};

function parseReorderPayload(value: unknown): ReorderItem[] | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Payload non valido." };
  }

  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 300) {
    return { error: "Elenco ordinamento non valido." };
  }

  const parsed: ReorderItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Elemento ordinamento non valido." };
    }

    const record = item as Record<string, unknown>;
    const itemId = typeof record.id === "string" ? record.id.trim() : "";
    const sortOrder = parseSortOrder(record.sort_order);
    if (!itemId || sortOrder === null) {
      return { error: "Ogni elemento deve includere id e ordine numerico." };
    }

    parsed.push({ id: itemId, sort_order: sortOrder });
  }

  return parsed;
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

  const items = parseReorderPayload(body);
  if ("error" in items) {
    return NextResponse.json({ error: items.error }, { status: 400 });
  }

  const service = createServiceClient();
  const updates = await Promise.all(
    items.map((item) =>
      service
        .from("subcategories")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
        .eq("category_id", id),
    ),
  );
  const failed = updates.find((result) => result.error);

  if (failed?.error) {
    logApiError("ADMIN SUBCATEGORIES ERROR", {
      query: "subcategories reorder",
      category_id: id,
      error: failed.error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile riordinare le sottocategorie." },
      { status: 500 },
    );
  }

  revalidateCategoryCatalog();

  return NextResponse.json({ ok: true });
}
