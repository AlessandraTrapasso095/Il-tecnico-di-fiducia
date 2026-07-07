import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { createServiceClient } from "@/lib/supabase/service";

type UpdateQuotePayload = {
  status: "accepted" | "rejected";
};

type QuoteRow = {
  id: string;
  conversation_id: string;
  professional_id: string;
  client_id: string;
  description: string;
  amount: number | string;
  discount_percentage: number;
  final_amount: number | string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
};

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function serializeQuote(row: QuoteRow) {
  return {
    ...row,
    amount: toNumber(row.amount),
    final_amount: toNumber(row.final_amount),
  };
}

function fullName(person: { first_name?: string | null; last_name?: string | null } | null) {
  return `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Utente";
}

async function loadQuotePeople(quote: QuoteRow) {
  const service = createServiceClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .in("id", [quote.client_id, quote.professional_id]);

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return {
    client: byId.get(quote.client_id) ?? null,
    professional: byId.get(quote.professional_id) ?? null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdateQuotePayload;
  try {
    payload = (await request.json()) as UpdateQuotePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.status !== "accepted" && payload.status !== "rejected") {
    return NextResponse.json({ error: "Invalid quote status" }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("quotes")
    .select(
      "id, conversation_id, professional_id, client_id, description, amount, discount_percentage, final_amount, status, created_at, updated_at, accepted_at, rejected_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }

  const currentQuote = current as QuoteRow | null;
  if (!currentQuote || currentQuote.client_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (currentQuote.status !== "pending") {
    return NextResponse.json({ error: "Quote already decided" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("quotes")
    .update({
      status: payload.status,
      accepted_at: payload.status === "accepted" ? now : null,
      rejected_at: payload.status === "rejected" ? now : null,
    })
    .eq("id", id)
    .eq("client_id", user.id)
    .eq("status", "pending")
    .select(
      "id, conversation_id, professional_id, client_id, description, amount, discount_percentage, final_amount, status, created_at, updated_at, accepted_at, rejected_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const quote = data as QuoteRow;
  const people = await loadQuotePeople(quote);
  const clientName = fullName(people.client);
  const professionalName = fullName(people.professional);
  const accepted = payload.status === "accepted";
  const baseUrl = appBaseUrl();
  const href = `${baseUrl}/professionista/messaggi?conversation=${encodeURIComponent(
    quote.conversation_id,
  )}`;

  const service = createServiceClient();
  const { error: notificationError } = await service.from("notifications").insert({
    recipient_id: quote.professional_id,
    actor_id: user.id,
    type: accepted ? "quote_accepted" : "quote_rejected",
    entity_type: "conversation",
    entity_id: quote.conversation_id,
  });

  if (notificationError) {
    console.error("[quotes] Failed to create quote decision notification", notificationError);
  }

  try {
    await sendTransactionalEmail({
      to: people.professional?.email,
      subject: accepted
        ? "Preventivo accettato - Il Tecnico di Fiducia"
        : "Preventivo rifiutato - Il Tecnico di Fiducia",
      text: [
        `Ciao ${professionalName},`,
        "",
        `${clientName} ha ${accepted ? "accettato" : "rifiutato"} il tuo preventivo.`,
        "",
        `Apri la conversazione: ${href}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Preventivo ${accepted ? "accettato" : "rifiutato"}</h2>
          <p>Ciao ${escapeHtml(professionalName)},</p>
          <p><strong>${escapeHtml(clientName)}</strong> ha ${accepted ? "accettato" : "rifiutato"} il tuo preventivo.</p>
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri conversazione
            </a>
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("[quotes] Failed to send quote decision email", emailError);
  }

  return NextResponse.json({ quote: serializeQuote(quote) });
}
