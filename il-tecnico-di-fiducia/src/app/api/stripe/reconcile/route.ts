import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { getStripe } from "@/lib/server/stripe";
import { upsertProfessionalSubscriptionFromStripe } from "@/lib/server/stripe-subscriptions";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function isValidBearer(authHeader: string | null, expected: string | null) {
  if (!expected) return false;
  if (!authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return match[1] === expected;
}

async function authorizeReconcile(request: Request) {
  const reconcileSecret = process.env.STRIPE_RECONCILE_SECRET ?? null;
  if (isValidBearer(request.headers.get("authorization"), reconcileSecret)) {
    return { ok: true as const, via: "secret" as const };
  }

  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return { ok: false as const, response: auth.response };

  return { ok: true as const, via: "admin" as const };
}

export async function POST(request: Request) {
  const authz = await authorizeReconcile(request);
  if (!authz.ok) return authz.response;

  const stripe = getStripe();
  const service = createServiceClient();

  let payload: { professional_id?: string | null } | null = null;
  try {
    payload = (await request.json()) as { professional_id?: string | null };
  } catch {
    payload = null;
  }

  let builder = service
    .from("professional_subscriptions")
    .select("professional_id, stripe_customer_id, stripe_subscription_id")
    .not("stripe_subscription_id", "is", null);

  if (payload?.professional_id) {
    builder = builder.eq("professional_id", payload.professional_id);
  }

  const { data: rows, error } = await builder;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updates: Array<{ professional_id: string; status: string }> = [];

  for (const row of rows ?? []) {
    const professionalId = row.professional_id as string;
    const subscriptionId = row.stripe_subscription_id as string | null;
    const customerId = (row.stripe_customer_id as string | null) ?? null;

    if (!subscriptionId) continue;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const nextRow = await upsertProfessionalSubscriptionFromStripe(service, {
        professionalId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end ?? null,
      });

      updates.push({ professional_id: professionalId, status: nextRow.status });
    } catch (err) {
      // If the subscription no longer exists, mark as inactive.
      const message = err instanceof Error ? err.message : "";
      const notFound =
        message.toLowerCase().includes("no such subscription") ||
        message.toLowerCase().includes("resource missing") ||
        message.toLowerCase().includes("not found");

      if (notFound) {
        const { error: clearError } = await service
          .from("professional_subscriptions")
          .update({
            status: "none",
            stripe_subscription_id: null,
            current_period_end: null,
          })
          .eq("professional_id", professionalId);

        if (!clearError) {
          updates.push({ professional_id: professionalId, status: "none" });
        }

        continue;
      }

      return NextResponse.json(
        { error: `Reconcile failed for ${professionalId}: ${message || "unknown error"}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, updated: updates.length, updates });
}

