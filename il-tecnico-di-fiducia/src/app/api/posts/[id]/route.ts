import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

type UpdatePayload = {
  title: string;
  body: string;
};

const MAX_POST_TITLE_LENGTH = 120;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.title)) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const title = payload.title.trim();

  if (title.length > MAX_POST_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `title must be at most ${MAX_POST_TITLE_LENGTH} characters` },
      { status: 400 },
    );
  }

  const updates = {
    title,
    body: payload.body.trim(),
  };

  const { data, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", id)
    .select("id, author_id, title, body, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ post: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional", "admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: attachments, error: attachmentError } = await supabase
    .from("post_attachments")
    .select("file_path")
    .eq("post_id", id);

  if (attachmentError) {
    return NextResponse.json(
      { error: attachmentError.message },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const storagePaths = (attachments ?? [])
    .map((attachment) => attachment.file_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    const service = createServiceClient();
    const { error: storageError } = await service.storage
      .from("public-media")
      .remove(storagePaths);

    if (storageError) {
      return NextResponse.json(
        {
          error: `Post deleted, but storage cleanup failed: ${storageError.message}`,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
