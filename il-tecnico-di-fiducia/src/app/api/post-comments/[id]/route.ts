import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type UpdateCommentPayload = {
  body: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdateCommentPayload;
  try {
    payload = (await request.json()) as UpdateCommentPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .update({ body: payload.body.trim() })
    .eq("id", id)
    .select("id, post_id, author_id, body, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    comment: {
      ...data,
      author: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("post_comments").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
