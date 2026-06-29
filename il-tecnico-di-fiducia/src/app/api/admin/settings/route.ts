import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type AdminSettingsPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  notifications?: {
    new_requests?: boolean;
    messages?: boolean;
    reviews?: boolean;
    email?: boolean;
  };
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

  if (payload.notifications !== undefined) {
    const notificationUpdates: Record<string, boolean> = {};
    for (const key of ["new_requests", "messages", "reviews", "email"] as const) {
      const value = payload.notifications[key];
      if (value !== undefined) {
        if (typeof value !== "boolean") {
          return NextResponse.json(
            { error: `notifications.${key} must be boolean` },
            { status: 400 },
          );
        }
        notificationUpdates[key] = value;
      }
    }

    if (Object.keys(notificationUpdates).length > 0) {
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: profile.id,
          ...notificationUpdates,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
  }

  await writeAuditLog(supabase, {
    actorId: profile.id,
    action: "admin.update_own_settings",
    targetType: "profile",
    targetId: profile.id,
    metadata: {
      profile_fields: Object.keys(updates),
      notifications_changed: payload.notifications !== undefined,
      email_update_pending: emailUpdatePending,
    },
  });

  return NextResponse.json({ ok: true, email_update_pending: emailUpdatePending });
}
