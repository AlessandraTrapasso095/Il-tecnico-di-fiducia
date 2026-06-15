import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import { sanitizeFileName } from "@/lib/api/validation";

const MAX_FILES = 6;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

type PostAttachmentInsertRow = {
  id: string;
  post_id: string;
  file_url: string;
  file_path: string | null;
  file_type: "image" | "video";
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.author_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  if (files.length === 0) {
    return NextResponse.json({ error: "files are required" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });
  }

  const attachments = [];

  for (const item of files) {
    if (!(item instanceof File)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }
    if (item.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Max file size is 50MB" }, { status: 400 });
    }

    let contentType: string | null = await sniffImageMime(item);
    let mediaType: "image" | "video" | null = null;

    if (contentType && ALLOWED_IMAGE_TYPES.has(contentType)) {
      mediaType = "image";
    } else {
      contentType = await sniffIsoBmffVideoMime(item);
      if (contentType && ALLOWED_VIDEO_TYPES.has(contentType)) {
        mediaType = "video";
      }
    }

    if (!contentType || !mediaType) {
      return NextResponse.json(
        { error: "Unsupported file type (allowed: JPG/PNG/WebP/MP4/MOV)" },
        { status: 400 },
      );
    }

    const safeName = sanitizeFileName(item.name || "post-media");
    const path = `${user.id}/posts/${postId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("public-media")
      .upload(path, item, { upsert: false, contentType, cacheControl: "3600" });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicUrl } = supabase.storage.from("public-media").getPublicUrl(path);

    const { data: inserted, error: insertError } = await supabase
      .from("post_attachments")
      .insert({
        post_id: postId,
        user_id: user.id,
        file_url: publicUrl.publicUrl,
        file_path: path,
        file_type: mediaType,
        mime_type: contentType,
        file_name: safeName,
        file_size: item.size,
      })
      .select("id, post_id, file_url, file_path, file_type, mime_type, file_name, file_size, created_at")
      .single();

    if (insertError) {
      await supabase.storage.from("public-media").remove([path]);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const attachment = inserted as PostAttachmentInsertRow;
    attachments.push({
      ...attachment,
      public_url: attachment.file_url,
      media_type: attachment.file_type,
    });
  }

  return NextResponse.json({ attachments });
}
