import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { isProfessionalVisibleToCustomers } from "@/lib/server/professional-visibility";
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

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  province_code: string | null;
  role: string;
};

type ProfessionalProfileRow = {
  id: string;
  avatar_url: string | null;
  headline: string | null;
  public_email: string | null;
  specializations: string[] | null;
};

type ProfessionalDirectoryRow = {
  id: string;
  avatar_url: string | null;
  headline: string | null;
  specializations: string[] | null;
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

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? null;
}

function firstArrayValue(...values: Array<string[] | null | undefined>) {
  for (const value of values) {
    const first = value?.map((item) => item.trim()).find(Boolean);
    if (first) return first;
  }
  return null;
}

async function loadQuoteContext(conversationId: string) {
  const service = createServiceClient();
  const { data: conversation, error: conversationError } = await service
    .from("conversations")
    .select("id, request_id, status, customer_id, professional_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error("[quotes] Failed to load conversation context", {
      conversationId,
      error: conversationError,
    });
  }

  if (!conversation) return null;

  const [
    { data: profiles, error: profilesError },
    { data: professionalProfile, error: professionalProfileError },
    { data: professionalDirectory, error: professionalDirectoryError },
    { data: categoryLinks, error: categoryLinksError },
  ] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, first_name, last_name, phone, province_code, role")
      .in("id", [conversation.customer_id, conversation.professional_id]),
    service
      .from("professional_profiles")
      .select("id, avatar_url, headline, public_email, specializations")
      .eq("id", conversation.professional_id)
      .maybeSingle(),
    service
      .from("professional_directory")
      .select("id, avatar_url, headline, specializations")
      .eq("id", conversation.professional_id)
      .maybeSingle(),
    service
      .from("professional_categories")
      .select("category_id")
      .eq("professional_id", conversation.professional_id),
  ]);

  for (const [stage, error] of [
    ["profiles", profilesError],
    ["professional_profiles", professionalProfileError],
    ["professional_directory", professionalDirectoryError],
    ["professional_categories", categoryLinksError],
  ] as const) {
    if (error) {
      console.error("[quotes] Failed to enrich quote context", {
        conversationId,
        stage,
        error,
      });
    }
  }

  const categoryIds = Array.from(
    new Set((categoryLinks ?? []).map((row) => row.category_id).filter(Boolean)),
  );
  const { data: categories, error: categoriesError } =
    categoryIds.length > 0
      ? await service.from("categories").select("id, name").in("id", categoryIds)
      : { data: [], error: null };

  if (categoriesError) {
    console.error("[quotes] Failed to load professional categories", {
      conversationId,
      error: categoriesError,
    });
  }

  const profileRows = (profiles ?? []) as ProfileRow[];
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const professional = profileById.get(conversation.professional_id) ?? null;
  const client = profileById.get(conversation.customer_id) ?? null;
  const professionalDetails = professionalProfile as ProfessionalProfileRow | null;
  const directoryDetails = professionalDirectory as ProfessionalDirectoryRow | null;
  const provinceCodes = Array.from(
    new Set([professional?.province_code, client?.province_code].filter(Boolean)),
  ) as string[];
  const { data: provinces, error: provincesError } =
    provinceCodes.length > 0
      ? await service.from("provinces").select("code, name").in("code", provinceCodes)
      : { data: [], error: null };

  if (provincesError) {
    console.error("[quotes] Failed to load quote context provinces", {
      conversationId,
      error: provincesError,
    });
  }

  const provinceByCode = new Map((provinces ?? []).map((province) => [province.code, province.name]));
  const categoryNames = (categories ?? []).map((category) => category.name).filter(Boolean);
  const professionLabel = firstNonEmpty(
    professionalDetails?.headline,
    directoryDetails?.headline,
    categoryNames.join(", "),
    firstArrayValue(professionalDetails?.specializations, directoryDetails?.specializations),
  );

  return {
    conversation,
    professional: professional
      ? {
          id: professional.id,
          email: professionalDetails?.public_email || professional.email,
          first_name: professional.first_name,
          last_name: professional.last_name,
          province_code: professional.province_code,
          province_name: professional.province_code
            ? provinceByCode.get(professional.province_code) ?? professional.province_code
            : null,
          phone: professional.phone,
          avatar_url: professionalDetails?.avatar_url ?? directoryDetails?.avatar_url ?? null,
          headline: professionLabel,
        }
      : null,
    client: client
      ? {
          id: client.id,
          email: client.email,
          first_name: client.first_name,
          last_name: client.last_name,
          province_code: client.province_code,
          province_name: client.province_code
            ? provinceByCode.get(client.province_code) ?? client.province_code
            : null,
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

  const { supabase, profile } = auth.ctx;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, professional_id")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    profile.role === "customer" &&
    !(await isProfessionalVisibleToCustomers(conversation.professional_id))
  ) {
    return NextResponse.json(
      { error: "Chat unavailable: professional subscription is not active" },
      { status: 403 },
    );
  }

  const context = await loadQuoteContext(id);
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, conversation_id, professional_id, client_id, description, amount, discount_percentage, final_amount, status, created_at, updated_at, accepted_at, rejected_at",
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[quotes] Failed to load quotes", { conversationId: id, error });
    return NextResponse.json({
      quotes: [],
      context,
      quotes_available: false,
    });
  }

  return NextResponse.json({
    quotes: ((data ?? []) as QuoteRow[]).map(serializeQuote),
    context,
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

  if (!(await isProfessionalVisibleToCustomers(conversation.professional_id))) {
    return NextResponse.json(
      { error: "Chat unavailable: professional subscription is not active" },
      { status: 403 },
    );
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
