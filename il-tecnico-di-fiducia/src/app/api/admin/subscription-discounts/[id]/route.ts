import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { getStripe } from "@/lib/server/stripe";

type UpdateDiscountPayload = {
  is_active: boolean;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;
  const { id } = await params;

  if (!isNonEmptyString(id)) {
    return NextResponse.json({ error: "ID sconto mancante." }, { status: 400 });
  }

  let payload: UpdateDiscountPayload;
  try {
    payload = (await request.json()) as UpdateDiscountPayload;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  if (typeof payload.is_active !== "boolean") {
    return NextResponse.json({ error: "Stato non valido." }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("subscription_discount_codes")
    .select("id, stripe_promotion_code_id, code")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Codice sconto non trovato." }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    await stripe.promotionCodes.update(current.stripe_promotion_code_id, {
      active: payload.is_active,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossibile aggiornare il codice su Stripe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("subscription_discount_codes")
    .update({ is_active: payload.is_active })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(supabase, {
    actorId: profile.id,
    action: "admin.update_subscription_discount_code",
    targetType: "subscription_discount_code",
    targetId: id,
    metadata: {
      code: current.code,
      is_active: payload.is_active,
    },
  });

  return NextResponse.json({ discount: data });
}
