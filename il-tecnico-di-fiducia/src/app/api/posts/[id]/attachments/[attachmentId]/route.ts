import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id: postId, attachmentId } = await params;

  if (!postId || !attachmentId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 400 });
  }

  if (!post || post.author_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from("post_attachments")
    .select("id, post_id, file_path")
    .eq("id", attachmentId)
    .eq("post_id", postId)
    .maybeSingle();

  if (attachmentError) {
    return NextResponse.json({ error: attachmentError.message }, { status: 400 });
  }

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("post_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("post_id", postId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (attachment.file_path) {
    const service = createServiceClient();
    const { error: storageError } = await service.storage
      .from("public-media")
      .remove([attachment.file_path]);

    if (storageError) {
      return NextResponse.json(
        { error: `Attachment deleted, but storage cleanup failed: ${storageError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
