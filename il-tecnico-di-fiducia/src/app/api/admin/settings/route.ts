import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type AdminSettingsPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
};

export async function PATCH(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"], allowMustChangePassword: true });
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  let payload: AdminSettingsPayload;
  try {
    payload = (await request.json()) as AdminSettingsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string> = {};

  if (payload.first_name !== undefined) updates.first_name = String(payload.first_name).trim();
  if (payload.last_name !== undefined) updates.last_name = String(payload.last_name).trim();

  const nextEmail =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  let emailUpdatePending = false;

  if (nextEmail !== null) {
    if (!isNonEmptyString(nextEmail)) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (nextEmail !== profile.email.toLowerCase()) {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      emailUpdatePending = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("profiles").update(updates).eq("id", profile.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, email_update_pending: emailUpdatePending });
}
