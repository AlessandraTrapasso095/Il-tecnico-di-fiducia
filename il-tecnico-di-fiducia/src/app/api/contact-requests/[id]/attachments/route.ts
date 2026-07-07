import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  isPdfFile,
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import { sanitizeFileName } from "@/lib/api/validation";

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (matches UI spec)

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime", // iOS .mov
  "application/pdf",
]);

function fileKind(mimeType: string | null | undefined): "image" | "video" | "document" {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  return "document";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { id: requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Participant check (RLS will enforce this).
  const { data: reqRow } = await supabase
    .from("contact_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const all = formData.getAll("files");
  const single = formData.get("file");
  const files = all.length > 0 ? all : single ? [single] : [];

  if (files.length === 0) {
    return NextResponse.json({ error: "files are required" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });
  }

  const uploadedPaths: string[] = [];

  for (const item of files) {
    if (!(item instanceof File)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    if (item.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Max file size is 50MB" },
        { status: 400 },
      );
    }

    // Defense-in-depth: validate file signatures for common types to avoid spoofed MIME uploads.
    // For video, allow the client-provided MIME if sniffing fails (to reduce false negatives).
    let contentType: string | null = await sniffImageMime(item);
    if (!contentType) {
      contentType = await sniffIsoBmffVideoMime(item);
    }
    if (!contentType && (await isPdfFile(item))) {
      contentType = "application/pdf";
    }
    if (!contentType) {
      contentType = item.type || null;
    }

    if (!contentType || !ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type (allowed: JPG/PNG/WebP/MP4/MOV/PDF)" },
        { status: 400 },
      );
    }

    const safeName = sanitizeFileName(item.name || "attachment");
    const path = `${user.id}/requests/${requestId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("private-media")
      .upload(path, item, { upsert: false, contentType, cacheControl: "3600" });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    uploadedPaths.push(path);
  }

  return NextResponse.json({ paths: uploadedPaths });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: reqRow } = await supabase
    .from("contact_requests")
    .select("customer_id, professional_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prefixes = [
    `${reqRow.customer_id}/requests/${requestId}`,
    `${reqRow.professional_id}/requests/${requestId}`,
  ];

  const expiresInSeconds = 60;
  const objects: {
    path: string;
    signed_url: string;
    expires_at: string;
    file_name: string;
    file_type: "image" | "video" | "document";
    mime_type: string | null;
    file_size: number | null;
  }[] = [];

  for (const prefix of prefixes) {
    const { data: listed, error: listError } = await supabase.storage
      .from("private-media")
      .list(prefix, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    for (const obj of listed ?? []) {
      if (!obj.id) continue; // folder
      const fullPath = `${prefix}/${obj.name}`;
      const { data, error } = await supabase.storage
        .from("private-media")
        .createSignedUrl(fullPath, expiresInSeconds, { download: true });

      if (error) {
        continue;
      }

      const metadata = obj.metadata as
        | { mimetype?: string; mimeType?: string; size?: number }
        | null
        | undefined;
      const mimeType = metadata?.mimetype ?? metadata?.mimeType ?? null;

      objects.push({
        path: fullPath,
        signed_url: data.signedUrl,
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        file_name: obj.name,
        file_type: fileKind(mimeType),
        mime_type: mimeType,
        file_size: typeof metadata?.size === "number" ? metadata.size : null,
      });
    }
  }

  return NextResponse.json({ attachments: objects });
}
