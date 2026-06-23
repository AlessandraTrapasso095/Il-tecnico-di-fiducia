import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { normalizeItalianProvinceCode } from "@/lib/locations/italian-provinces";

type AccountSettingsPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  province_code?: string | null;
  phone?: string | null;
  notifications?: {
    new_requests?: boolean;
    messages?: boolean;
    reviews?: boolean;
    email?: boolean;
  };
};

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

export async function PATCH(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  let payload: AccountSettingsPayload;
  try {
    payload = (await request.json()) as AccountSettingsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileUpdates: Record<string, string | null> = {};

  if (payload.first_name !== undefined) {
    if (!isNonEmptyString(payload.first_name)) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    profileUpdates.first_name = payload.first_name.trim();
  }

  if (payload.last_name !== undefined) {
    if (!isNonEmptyString(payload.last_name)) {
      return NextResponse.json({ error: "Cognome obbligatorio" }, { status: 400 });
    }
    profileUpdates.last_name = payload.last_name.trim();
  }

  if (payload.province_code !== undefined) {
    const normalizedProvince = normalizeItalianProvinceCode(payload.province_code);
    if (!normalizedProvince) {
      return NextResponse.json({ error: "Provincia non valida" }, { status: 400 });
    }
    profileUpdates.province_code = normalizedProvince;
  }

  if (payload.phone !== undefined) {
    profileUpdates.phone = normalizeOptionalText(payload.phone);
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  let emailUpdatePending = false;
  if (payload.email !== undefined && !isNonEmptyString(payload.email)) {
    return NextResponse.json({ error: "Email obbligatoria" }, { status: 400 });
  }

  const cleanEmail = normalizeOptionalText(payload.email);
  if (cleanEmail && cleanEmail.toLowerCase() !== profile.email.toLowerCase()) {
    const { error: emailError } = await supabase.auth.updateUser({ email: cleanEmail });
    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 400 });
    }
    emailUpdatePending = true;
  }

  if (payload.notifications) {
    const notificationUpdates = {
      user_id: user.id,
      new_requests: Boolean(payload.notifications.new_requests),
      messages: Boolean(payload.notifications.messages),
      reviews: Boolean(payload.notifications.reviews),
      email: Boolean(payload.notifications.email),
      updated_at: new Date().toISOString(),
    };

    const { error: preferencesError } = await supabase
      .from("notification_preferences")
      .upsert(notificationUpdates, { onConflict: "user_id" });

    if (preferencesError) {
      return NextResponse.json({ error: preferencesError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, email_update_pending: emailUpdatePending });
}
