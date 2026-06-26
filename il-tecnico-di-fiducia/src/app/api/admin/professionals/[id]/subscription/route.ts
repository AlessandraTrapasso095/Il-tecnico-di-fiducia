import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type ForceSubscriptionPayload = {
  status: "none" | "admin_forced_active" | "suspended";
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  const { id: professionalId } = await params;
  if (!isNonEmptyString(professionalId)) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: ForceSubscriptionPayload;
  try {
    payload = (await request.json()) as ForceSubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    payload.status !== "none" &&
    payload.status !== "admin_forced_active" &&
    payload.status !== "suspended"
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const baseRow = {
    professional_id: professionalId,
    status: payload.status,
  };

  const nextRow: Record<string, unknown> =
    payload.status === "none"
      ? {
          ...baseRow,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          current_period_end: null,
        }
      : baseRow;

  const { data, error } = await supabase
    .from("professional_subscriptions")
    .upsert(nextRow as never, { onConflict: "professional_id" })
    .select("professional_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(supabase, {
    actorId: profile.id,
    action: "admin.update_subscription",
    targetType: "professional_subscription",
    targetId: professionalId,
    metadata: { status: payload.status },
  });

  return NextResponse.json({ subscription: data });
}
