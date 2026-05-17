import { NextResponse } from "next/server";

import { assertNotLastAdmin } from "@/lib/api/admin-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { deleteAllStorageObjectsForUser } from "@/lib/storage/delete-user-storage";

export async function DELETE() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Avoid locking the project out: do not allow deleting the last admin account.
  try {
    const guard = await assertNotLastAdmin(supabase, user.id, "delete");
    if (!guard.ok && guard.reason === "last_admin") {
      return NextResponse.json({ error: guard.message }, { status: 400 });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to validate admin safety";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Best-effort sign-out so cookies are cleared even if deletion fails later.
  await supabase.auth.signOut();

  let service;
  try {
    service = createServiceClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize service client";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await deleteAllStorageObjectsForUser(service, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Best-effort: revoke refresh tokens across devices before deleting.
  try {
    await service.auth.admin.signOut(user.id);
  } catch {
    // ignore
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
