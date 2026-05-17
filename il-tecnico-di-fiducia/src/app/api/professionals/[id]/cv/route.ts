import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function GET(
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

  const { data: path, error: pathError } = await supabase.rpc(
    "get_professional_cv_path",
    { pro_id: id },
  );

  if (pathError) {
    return NextResponse.json({ error: "Failed to load CV" }, { status: 500 });
  }

  if (!path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expiresInSeconds = 60;
  const { data, error } = await supabase.storage
    .from("private-media")
    .createSignedUrl(path, expiresInSeconds, { download: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    signed_url: data.signedUrl,
    expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}
