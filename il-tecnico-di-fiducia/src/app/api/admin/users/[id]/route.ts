import { NextResponse } from "next/server";

import { assertNotLastAdmin } from "@/lib/api/admin-guards";
import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteAllStorageObjectsForUser } from "@/lib/storage/delete-user-storage";

type AdminUpdateUserPayload = {
  is_banned?: boolean;
  must_change_password?: boolean;
};

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (targetUserId === auth.ctx.user.id) {
    return NextResponse.json(
      { error: "Use /api/account to delete your own account" },
      { status: 400 },
    );
  }

  try {
    const guard = await assertNotLastAdmin(supabase, targetUserId, "delete");
    if (!guard.ok) {
      if (guard.reason === "not_found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (guard.reason === "last_admin") {
        return NextResponse.json({ error: guard.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to validate admin safety";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize service client";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await deleteAllStorageObjectsForUser(service, targetUserId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Best-effort: revoke refresh tokens across devices before deleting.
  try {
    await service.auth.admin.signOut(targetUserId);
  } catch {
    // ignore
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await writeAuditLog(supabase, {
    actorId: auth.ctx.profile.id,
    action: "admin.delete_user",
    targetType: "profile",
    targetId: targetUserId,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: targetUserId } = await params;
  if (!isNonEmptyString(targetUserId)) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: AdminUpdateUserPayload;
  try {
    payload = (await request.json()) as AdminUpdateUserPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (payload.is_banned !== undefined) {
    if (typeof payload.is_banned !== "boolean") {
      return NextResponse.json({ error: "is_banned must be boolean" }, { status: 400 });
    }
    updates.is_banned = payload.is_banned;
  }

  if (payload.must_change_password !== undefined) {
    if (typeof payload.must_change_password !== "boolean") {
      return NextResponse.json(
        { error: "must_change_password must be boolean" },
        { status: 400 },
      );
    }
    updates.must_change_password = payload.must_change_password;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  if (payload.is_banned === true) {
    try {
      const guard = await assertNotLastAdmin(supabase, targetUserId, "ban");
      if (!guard.ok) {
        if (guard.reason === "not_found") {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (guard.reason === "last_admin") {
          return NextResponse.json({ error: guard.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate admin safety";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", targetUserId)
    .select("id, role, email, is_banned, must_change_password, created_at, updated_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payload.is_banned === true) {
    // Revoke refresh tokens immediately (best-effort).
    try {
      const service = createServiceClient();
      await service.auth.admin.signOut(targetUserId);
    } catch {
      // ignore
    }
  }

  await writeAuditLog(supabase, {
    actorId: auth.ctx.profile.id,
    action:
      payload.is_banned === true
        ? "admin.suspend_user"
        : payload.is_banned === false
          ? "admin.reactivate_user"
          : "admin.update_user",
    targetType: "profile",
    targetId: targetUserId,
    metadata: updates,
  });

  return NextResponse.json({ profile: updated });
}
