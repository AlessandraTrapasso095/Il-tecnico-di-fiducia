import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { parseSortOrder } from "@/lib/server/category-management";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type ReorderItem = {
  id: string;
  sort_order: number;
};

function parseReorderPayload(value: unknown): ReorderItem[] | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Payload non valido." };
  }

  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    return { error: "Elenco ordinamento non valido." };
  }

  const parsed: ReorderItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Elemento ordinamento non valido." };
    }

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const sortOrder = parseSortOrder(record.sort_order);
    if (!id || sortOrder === null) {
      return { error: "Ogni elemento deve includere id e ordine numerico." };
    }

    parsed.push({ id, sort_order: sortOrder });
  }

  return parsed;
}

export async function PATCH(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

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
      service.from("categories").update({ sort_order: item.sort_order }).eq("id", item.id),
    ),
  );
  const failed = updates.find((result) => result.error);

  if (failed?.error) {
    logApiError("ADMIN CATEGORIES ERROR", {
      query: "categories reorder",
      error: failed.error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile riordinare le categorie." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
