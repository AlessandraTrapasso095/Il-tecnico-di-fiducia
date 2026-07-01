import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { ensureSocialNotification } from "@/lib/server/social-notifications";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("post_likes").upsert(
    { post_id: id, user_id: user.id },
    { onConflict: "post_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: post } = await service
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  await ensureSocialNotification({
    recipientId: post?.author_id,
    actorId: user.id,
    type: "post_liked",
    entityType: "post",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
