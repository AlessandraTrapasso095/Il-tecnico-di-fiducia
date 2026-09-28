import { NextResponse } from "next/server";

import { assertNotLastAdmin } from "@/lib/api/admin-guards";
import { writeAuditLog } from "@/lib/api/audit-log";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { deleteAllStorageObjectsForUser } from "@/lib/storage/delete-user-storage";
import { internalServerError } from "@/lib/api/internal-server-error";

type DeleteAccountPayload = {
  confirm?: string;
};

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DeleteAccountPayload = {};
  try {
    payload = (await request.json()) as DeleteAccountPayload;
  } catch {
    payload = {};
  }

  if (payload.confirm?.trim().toUpperCase() !== "ELIMINA") {
    return NextResponse.json(
      { error: "Conferma richiesta: scrivi ELIMINA per eliminare l’account." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "professional") {
    const { data: subscription, error: subscriptionError } = await supabase
      .from("professional_subscriptions")
      .select("status, stripe_subscription_id")
      .eq("professional_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json(
        { error: "Impossibile verificare lo stato dell’abbonamento." },
        { status: 500 },
      );
    }

    if (
      subscription?.status === "stripe_active" &&
      subscription.stripe_subscription_id
    ) {
      return NextResponse.json(
        {
          error:
            "Prima di eliminare l’account devi cancellare l’abbonamento Stripe dal portale abbonamento.",
        },
        { status: 409 },
      );
    }
  }

  // Avoid locking the project out: do not allow deleting the last admin account.
  try {
    const guard = await assertNotLastAdmin(supabase, user.id, "delete");
    if (!guard.ok && guard.reason === "last_admin") {
      return NextResponse.json({ error: guard.message }, { status: 400 });
    }
  } catch (err) {
    return internalServerError("ACCOUNT DELETE ADMIN SAFETY ERROR", err, {
      user_id: user.id,
    });
  }

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: "account.delete_own_account",
    targetType: "profile",
    targetId: user.id,
  });

  // Best-effort sign-out so cookies are cleared even if deletion fails later.
  await supabase.auth.signOut();

  let service;
  try {
    service = createServiceClient();
  } catch (err) {
    return internalServerError("ACCOUNT DELETE SERVICE CLIENT ERROR", err, {
      user_id: user.id,
    });
  }

  try {
    await deleteAllStorageObjectsForUser(service, user.id);
  } catch (err) {
    return internalServerError("ACCOUNT DELETE STORAGE CLEANUP ERROR", err, {
      user_id: user.id,
    });
  }

  // Best-effort: revoke refresh tokens across devices before deleting.
  try {
    await service.auth.admin.signOut(user.id);
  } catch {
    // ignore
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return internalServerError("ACCOUNT DELETE AUTH USER ERROR", deleteError, {
      user_id: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
