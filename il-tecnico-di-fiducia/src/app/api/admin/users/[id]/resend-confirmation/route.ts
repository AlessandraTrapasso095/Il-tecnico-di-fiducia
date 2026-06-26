import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase, profile: adminProfile } = auth.ctx;

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

  const service = createServiceClient();
  const { error } = await service.auth.resend({
    type: "signup",
    email: profile.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(supabase, {
    actorId: adminProfile.id,
    action: "admin.resend_confirmation",
    targetType: "profile",
    targetId: targetUserId,
  });

  return NextResponse.json({ ok: true });
}
