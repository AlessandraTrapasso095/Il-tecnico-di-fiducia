import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  loadActiveDiscountForProfessional,
  publicDiscountCode,
} from "@/lib/server/subscription-discounts";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  if (profile.role !== "professional") {
    return NextResponse.json({ subscription: null });
  }

  const { data: row, error } = await supabase
    .from("professional_subscriptions")
    .select("professional_id, status, current_period_end, updated_at")
    .eq("professional_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 },
    );
  }

  const { data: isActive, error: activeError } = await supabase.rpc(
    "professional_is_active_subscriber",
    { pro_id: user.id },
  );

  if (activeError) {
    return NextResponse.json(
      { error: "Failed to compute subscription status" },
      { status: 500 },
    );
  }

  const discount = Boolean(isActive)
    ? null
    : publicDiscountCode(await loadActiveDiscountForProfessional(user.id));

  return NextResponse.json({
    subscription: row ?? {
      professional_id: user.id,
      status: "none",
      current_period_end: null,
      updated_at: null,
    },
    is_active: Boolean(isActive),
    discount_code: discount,
  });
}
