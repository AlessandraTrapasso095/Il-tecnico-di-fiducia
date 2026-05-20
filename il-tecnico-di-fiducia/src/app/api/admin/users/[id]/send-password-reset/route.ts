import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { isNonEmptyString } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: targetUserId } = await params;
  if (!isNonEmptyString(targetUserId)) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile?.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl = getRequestBaseUrl(request);
  const redirectTo = `${baseUrl}/auth/callback?next=/auth/reset-password`;

  const service = createServiceClient();
  const { error } = await service.auth.resetPasswordForEmail(profile.email, { redirectTo });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
