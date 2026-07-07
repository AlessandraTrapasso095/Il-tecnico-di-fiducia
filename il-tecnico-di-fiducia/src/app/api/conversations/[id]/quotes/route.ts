import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { createServiceClient } from "@/lib/supabase/service";

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

type CreateQuotePayload = {
  description: string;
  amount: number;
  discount_percentage?: number;
};

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function serializeQuote(row: QuoteRow) {
  return {
    ...row,
    amount: toNumber(row.amount),
    final_amount: toNumber(row.final_amount),
  };
}

async function loadQuoteContext(conversationId: string) {
  const service = createServiceClient();
  const { data: conversation } = await service
    .from("conversations")
    .select("id, request_id, status, customer_id, professional_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return null;

  const [{ data: profiles }, { data: professionalProfile }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, first_name, last_name, phone, province_code, role")
      .in("id", [conversation.customer_id, conversation.professional_id]),
    service
      .from("professional_profiles")
      .select("id, avatar_url, headline, public_email")
      .eq("id", conversation.professional_id)
      .maybeSingle(),
  ]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const professional = profileById.get(conversation.professional_id) ?? null;
  const client = profileById.get(conversation.customer_id) ?? null;

  return {
    conversation,
    professional: professional
      ? {
          id: professional.id,
          email: professionalProfile?.public_email || professional.email,
          first_name: professional.first_name,
          last_name: professional.last_name,
          province_code: professional.province_code,
          phone: professional.phone,
          avatar_url: professionalProfile?.avatar_url ?? null,
          headline: professionalProfile?.headline ?? null,
        }
      : null,
    client: client
      ? {
          id: client.id,
          email: client.email,
          first_name: client.first_name,
          last_name: client.last_name,
          province_code: client.province_code,
          phone: client.phone,
        }
      : null,
  };
}

function fullName(person: { first_name?: string | null; last_name?: string | null } | null) {
  return `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Utente";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, conversation_id, professional_id, client_id, description, amount, discount_percentage, final_amount, status, created_at, updated_at, accepted_at, rejected_at",
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 });
  }

  return NextResponse.json({
    quotes: ((data ?? []) as QuoteRow[]).map(serializeQuote),
    context: await loadQuoteContext(id),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: CreateQuotePayload;
  try {
    payload = (await request.json()) as CreateQuotePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = String(payload.description ?? "").trim();
  const amount = Number(payload.amount);
  const discount = Number(payload.discount_percentage ?? 0);

  if (!isNonEmptyString(description)) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  if (![0, 10, 20, 30, 40, 50].includes(discount)) {
    return NextResponse.json({ error: "Invalid discount" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, status, customer_id, professional_id")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }

  if (!conversation || conversation.professional_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (conversation.status !== "accepted") {
    return NextResponse.json(
      { error: "Quotes can be sent only after the request is accepted" },
      { status: 403 },
    );
  }

  const finalAmount = roundMoney(amount * (1 - discount / 100));

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      conversation_id: id,
      professional_id: user.id,
      client_id: conversation.customer_id,
      description,
      amount: roundMoney(amount),
      discount_percentage: discount,
      final_amount: finalAmount,
      status: "pending",
    })
    .select(
      "id, conversation_id, professional_id, client_id, description, amount, discount_percentage, final_amount, status, created_at, updated_at, accepted_at, rejected_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const context = await loadQuoteContext(id);
  const professionalName = fullName(context?.professional ?? null);
  const clientName = fullName(context?.client ?? null);
  const baseUrl = appBaseUrl();
  const href = `${baseUrl}/customer?section=messages&conversation=${encodeURIComponent(id)}`;

  const service = createServiceClient();
  const { error: notificationError } = await service.from("notifications").insert({
    recipient_id: conversation.customer_id,
    actor_id: user.id,
    type: "quote_sent",
    entity_type: "conversation",
    entity_id: id,
  });

  if (notificationError) {
    console.error("[quotes] Failed to create quote notification", notificationError);
  }

  try {
    await sendTransactionalEmail({
      to: context?.client?.email,
      subject: "Nuovo preventivo ricevuto - Il Tecnico di Fiducia",
      text: [
        `Ciao ${clientName},`,
        "",
        `${professionalName} ti ha inviato un preventivo.`,
        `Importo finale: € ${finalAmount.toFixed(2)}`,
        "",
        `Apri la conversazione: ${href}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Nuovo preventivo ricevuto</h2>
          <p>Ciao ${escapeHtml(clientName)},</p>
          <p><strong>${escapeHtml(professionalName)}</strong> ti ha inviato un preventivo.</p>
          <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f1f3ff">
            <p style="margin:0 0 8px 0"><strong>Totale finale:</strong> € ${finalAmount.toFixed(2)}</p>
            <p style="margin:0">${escapeHtml(description).replaceAll("\n", "<br />")}</p>
          </div>
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri conversazione
            </a>
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("[quotes] Failed to send quote email", emailError);
  }

  return NextResponse.json({
    quote: serializeQuote(data as QuoteRow),
    context,
  });
}
