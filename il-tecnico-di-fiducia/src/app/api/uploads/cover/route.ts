import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { sniffImageMime } from "@/lib/api/file-signatures";
import { sanitizeFileName } from "@/lib/api/validation";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function tryExtractPublicMediaPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/public-media/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path.length > 0 ? path : null;
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const sniffedMime = await sniffImageMime(file);
  if (!sniffedMime || !ALLOWED_IMAGE_TYPES.has(sniffedMime)) {
    return NextResponse.json(
      { error: "Only JPG/PNG/WebP images are allowed" },
      { status: 400 },
    );
  }

  if (file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "Max file size is 6MB" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("professional_profiles")
    .select("cover_url")
    .eq("id", user.id)
    .maybeSingle();

  const safeName = sanitizeFileName(file.name || "cover");
  const path = `${user.id}/cover/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("public-media")
    .upload(path, file, { upsert: false, contentType: sniffedMime, cacheControl: "3600" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrl } = supabase.storage
    .from("public-media")
    .getPublicUrl(path);

  const coverUrl = publicUrl.publicUrl;

  const { error: updateError } = await supabase
    .from("professional_profiles")
    .update({ cover_url: coverUrl })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const previousPath = tryExtractPublicMediaPath(existing?.cover_url ?? null);
  if (previousPath) {
    await supabase.storage.from("public-media").remove([previousPath]);
  }

  return NextResponse.json({ cover_url: coverUrl, path });
}
