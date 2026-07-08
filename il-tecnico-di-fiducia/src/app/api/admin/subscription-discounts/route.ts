import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { appBaseUrl, escapeHtml, sendTransactionalEmail } from "@/lib/server/email";
import { getStripe } from "@/lib/server/stripe";
import {
  loadEligibleDiscountRecipients,
  type SubscriptionDiscountCode,
} from "@/lib/server/subscription-discounts";
import { createServiceClient } from "@/lib/supabase/service";

type CreateDiscountPayload = {
  title: string;
  code: string;
  percent_off: number;
  starts_at?: string | null;
  expires_at?: string | null;
  applies_to_all: boolean;
  professional_email?: string | null;
  is_active?: boolean;
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function parseIsoDate(value: unknown, endOfDay = false) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;

  const raw = value.trim();
  const candidate =
    endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T23:59:59.999Z`)
      : new Date(raw);

  if (Number.isNaN(candidate.getTime())) return undefined;
  return candidate.toISOString();
}

function validatePayload(payload: CreateDiscountPayload) {
  if (!isNonEmptyString(payload.title)) return "Il titolo è obbligatorio.";
  if (!isNonEmptyString(payload.code)) return "Il codice è obbligatorio.";

  const code = normalizeCode(payload.code);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
    return "Il codice può contenere solo lettere, numeri, trattini e underscore.";
  }

  if (
    !Number.isInteger(payload.percent_off) ||
    payload.percent_off <= 0 ||
    payload.percent_off > 100
  ) {
    return "La percentuale deve essere un numero intero tra 1 e 100.";
  }

  if (payload.applies_to_all !== true && payload.applies_to_all !== false) {
    return "Applicazione sconto non valida.";
  }

  if (!payload.applies_to_all && !isNonEmptyString(payload.professional_email)) {
    return "Inserisci l’email del professionista destinatario.";
  }

  const startsAt = parseIsoDate(payload.starts_at);
  const expiresAt = parseIsoDate(payload.expires_at, true);
  if (startsAt === undefined) return "Data inizio non valida.";
  if (expiresAt === undefined) return "Data fine non valida.";
  if (startsAt && expiresAt && new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
    return "La data fine deve essere successiva alla data inizio.";
  }

  return null;
}

function validityLabel(discount: Pick<SubscriptionDiscountCode, "starts_at" | "expires_at">) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const start = discount.starts_at ? formatter.format(new Date(discount.starts_at)) : "subito";
  const end = discount.expires_at ? formatter.format(new Date(discount.expires_at)) : "senza scadenza";
  return `Valido da ${start} a ${end}`;
}

async function notifyRecipients(
  discount: SubscriptionDiscountCode,
  recipients: Array<{ id: string; email: string; first_name: string; last_name: string }>,
  actorId: string,
) {
  const service = createServiceClient();
  const baseUrl = appBaseUrl();
  const subscriptionUrl = `${baseUrl}/professionista/abbonamento`;
  const validity = validityLabel(discount);

  if (recipients.length > 0) {
    const { error } = await service.from("notifications").insert(
      recipients.map((recipient) => ({
        recipient_id: recipient.id,
        actor_id: actorId,
        type: "subscription_discount_created",
        entity_type: "subscription_discount_code",
        entity_id: discount.id,
      })),
    );
    if (error) {
      console.error("[discounts] Failed to create discount notifications", error);
    }
  }

  await Promise.all(
    recipients.map(async (recipient) => {
      const name =
        `${recipient.first_name ?? ""} ${recipient.last_name ?? ""}`.trim() ||
        recipient.email;
      const text = [
        `Ciao ${name},`,
        "",
        `hai ricevuto un codice sconto per l’abbonamento professionista: ${discount.title}.`,
        `Codice: ${discount.code}`,
        `Sconto: ${discount.percent_off}%`,
        validity,
        "",
        `Gestisci l’abbonamento qui: ${subscriptionUrl}`,
      ].join("\n");

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
          <p>Ciao ${escapeHtml(name)},</p>
          <p>hai ricevuto un codice sconto per l’abbonamento professionista.</p>
          <div style="border:1px solid #dbe2f9;border-radius:16px;padding:18px;margin:18px 0;background:#f9f9ff">
            <strong>${escapeHtml(discount.title)}</strong><br />
            Codice: <strong style="color:#ff8500">${escapeHtml(discount.code)}</strong><br />
            Sconto: <strong>${discount.percent_off}%</strong><br />
            ${escapeHtml(validity)}
          </div>
          <p><a href="${escapeHtml(subscriptionUrl)}" style="display:inline-block;background:#ff8500;color:white;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:bold">Vai all’abbonamento</a></p>
        </div>
      `;

      try {
        await sendTransactionalEmail({
          to: recipient.email,
          subject: `Codice sconto abbonamento: ${discount.code}`,
          text,
          html,
        });
      } catch (error) {
        console.error("[discounts] Failed to send discount email", {
          recipient: recipient.email,
          error,
        });
      }
    }),
  );
}

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from("subscription_discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discounts: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  let payload: CreateDiscountPayload;
  try {
    payload = (await request.json()) as CreateDiscountPayload;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const code = normalizeCode(payload.code);
  const startsAt = parseIsoDate(payload.starts_at);
  const expiresAt = parseIsoDate(payload.expires_at, true);
  const professionalEmail = payload.professional_email?.trim().toLowerCase() || null;
  const isActive = payload.is_active !== false;

  const service = createServiceClient();
  const recipients = await loadEligibleDiscountRecipients(
    payload.applies_to_all
      ? { appliesToAll: true }
      : { appliesToAll: false, professionalEmail: professionalEmail as string },
    service,
  );

  if (!payload.applies_to_all && recipients.length === 0) {
    return NextResponse.json(
      { error: "Nessun professionista non abbonato trovato con questa email." },
      { status: 404 },
    );
  }

  let couponId: string;
  let promotionCodeId: string;
  try {
    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      duration: "forever",
      name: payload.title.trim(),
      percent_off: payload.percent_off,
      metadata: {
        source: "il_tecnico_di_fiducia",
        created_by: profile.id,
        title: payload.title.trim(),
      },
    });
    couponId = coupon.id;

    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      active: isActive,
      ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      metadata: {
        source: "il_tecnico_di_fiducia",
        created_by: profile.id,
        applies_to_all: String(payload.applies_to_all),
        professional_email: professionalEmail ?? "",
      },
    });
    promotionCodeId = promotionCode.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossibile creare il codice su Stripe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: discount, error } = await supabase
    .from("subscription_discount_codes")
    .insert({
      stripe_coupon_id: couponId,
      stripe_promotion_code_id: promotionCodeId,
      code,
      title: payload.title.trim(),
      percent_off: payload.percent_off,
      starts_at: startsAt,
      expires_at: expiresAt,
      applies_to_all: payload.applies_to_all,
      professional_id: payload.applies_to_all ? null : (recipients[0]?.id ?? null),
      professional_email: payload.applies_to_all ? null : professionalEmail,
      is_active: isActive,
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const typedDiscount = discount as SubscriptionDiscountCode;

  await writeAuditLog(supabase, {
    actorId: profile.id,
    action: "admin.create_subscription_discount_code",
    targetType: "subscription_discount_code",
    targetId: typedDiscount.id,
    metadata: {
      code,
      percent_off: payload.percent_off,
      applies_to_all: payload.applies_to_all,
      recipient_count: recipients.length,
    },
  });

  await notifyRecipients(typedDiscount, recipients, profile.id);

  return NextResponse.json({ discount: typedDiscount, notified: recipients.length });
}
