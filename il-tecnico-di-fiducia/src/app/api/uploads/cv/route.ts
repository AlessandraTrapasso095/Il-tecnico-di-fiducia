import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isPdfFile } from "@/lib/api/file-signatures";
import { sanitizeFileName } from "@/lib/api/validation";

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const safeName = sanitizeFileName(file.name || "cv.pdf");
  const isPdf = await isPdfFile(file);
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF is allowed" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max file size is 10MB" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("professional_profiles")
    .select("cv_storage_path")
    .eq("id", user.id)
    .maybeSingle();

  const path = `${user.id}/cvs/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("private-media")
    .upload(path, file, { upsert: false, contentType: "application/pdf", cacheControl: "3600" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  if (existing?.cv_storage_path) {
    await supabase.storage.from("private-media").remove([existing.cv_storage_path]);
  }

  const { error: updateError } = await supabase
    .from("professional_profiles")
    .update({ cv_storage_path: path })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ cv_storage_path: path });
}
