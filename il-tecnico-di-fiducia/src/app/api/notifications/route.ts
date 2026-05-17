import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";

type MarkReadPayload = {
  ids: string[];
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const limit = clampInt(request.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

  let builder = supabase
    .from("notifications")
    .select("id, recipient_id, actor_id, type, entity_type, entity_id, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    builder = builder.is("read_at", null);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }

  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  let payload: MarkReadPayload;
  try {
    payload = (await request.json()) as MarkReadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", payload.ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
