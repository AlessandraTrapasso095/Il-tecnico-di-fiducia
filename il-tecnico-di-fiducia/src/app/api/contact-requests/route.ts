import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { createServiceClient } from "@/lib/supabase/service";

type ContactRequestPayload = {
  professional_id: string;
  subject: string;
  message: string;
  privacy_accepted: boolean;
};

function isValidStatus(
  status: string,
): status is "pending" | "accepted" | "rejected" {
  return status === "pending" || status === "accepted" || status === "rejected";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status");

  if (statusFilter && !isValidStatus(statusFilter)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 20, 1, 100);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let builder = supabase
    .from("contact_requests")
    .select(
      "id, customer_id, professional_id, subject, message, privacy_accepted, status, responded_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (statusFilter) {
    builder = builder.eq("status", statusFilter);
  }

  if (profile.role === "customer") {
    builder = builder.eq("customer_id", user.id);
  } else if (profile.role === "professional") {
    builder = builder.eq("professional_id", user.id);
  }

  const { data: requests, error, count } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load requests" },
      { status: 500 },
    );
  }

  const rows = requests ?? [];
  const requestIds = rows.map((r) => r.id);

  const { data: conversations } = requestIds.length
    ? await supabase
        .from("conversations")
        .select("id, request_id")
        .in("request_id", requestIds)
    : { data: [] };

  const conversationIdByRequestId = new Map(
    (conversations ?? []).map((c) => [c.request_id, c.id]),
  );

  if (profile.role === "customer") {
    const proIds = Array.from(new Set(rows.map((r) => r.professional_id)));
    const { data: pros } =
      proIds.length > 0
        ? await supabase
            .from("professional_directory")
            .select("id, first_name, last_name, province_code, avatar_url, headline")
            .in("id", proIds)
        : { data: [] };

    const proById = new Map((pros ?? []).map((p) => [p.id, p]));

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: count ?? 0,
      requests: rows.map((r) => ({
        ...r,
        conversation_id: conversationIdByRequestId.get(r.id) ?? null,
        participant: proById.get(r.professional_id) ?? null,
      })),
    });
  }

  if (profile.role === "professional") {
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
    const { data: customers } =
      customerIds.length > 0
        ? await supabase
            .from("customer_directory")
            .select("id, first_name, last_name, province_code")
            .in("id", customerIds)
        : { data: [] };

    const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: count ?? 0,
      requests: rows.map((r) => ({
        ...r,
        conversation_id: conversationIdByRequestId.get(r.id) ?? null,
        participant: customerById.get(r.customer_id) ?? null,
      })),
    });
  }

  // Admin (or unexpected role): return bare rows.
  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    requests: rows.map((r) => ({
      ...r,
      conversation_id: conversationIdByRequestId.get(r.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  // requireAuth already enforced customer.

  let payload: ContactRequestPayload;
  try {
    payload = (await request.json()) as ContactRequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.privacy_accepted) {
    return NextResponse.json(
      { error: "Privacy must be accepted" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(payload.professional_id)) {
    return NextResponse.json(
      { error: "professional_id is required" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(payload.subject) || !isNonEmptyString(payload.message)) {
    return NextResponse.json(
      { error: "Subject and message are required" },
      { status: 400 },
    );
  }

  const { data: created, error } = await supabase
    .from("contact_requests")
    .insert({
      customer_id: user.id,
      professional_id: payload.professional_id,
      subject: payload.subject.trim(),
      message: payload.message.trim(),
      privacy_accepted: true,
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("request_id", created.id)
    .maybeSingle();

  try {
    const service = createServiceClient();
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, first_name, last_name, role")
      .in("id", [user.id, payload.professional_id]);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const customer = profileById.get(user.id);
    const professional = profileById.get(payload.professional_id);
    const customerName =
      `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
      "Cliente";
    const baseUrl = appBaseUrl();
    const link = `${baseUrl}/professionista/messaggi${
      conversation?.id ? `?conversation=${encodeURIComponent(conversation.id)}` : ""
    }`;
    const subject = "Nuova richiesta di contatto ricevuta";
    const text = [
      "Hai ricevuto una nuova richiesta su Il Tecnico di Fiducia.",
      "",
      `Cliente: ${customerName}`,
      `Email cliente: ${customer?.email ?? "Non disponibile"}`,
      `Oggetto: ${payload.subject.trim()}`,
      "",
      payload.message.trim(),
      "",
      `Apri la richiesta: ${link}`,
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Nuova richiesta di contatto</h2>
        <p>Hai ricevuto una nuova richiesta su <strong>Il Tecnico di Fiducia</strong>.</p>
        <p><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Email cliente:</strong> ${escapeHtml(customer?.email ?? "Non disponibile")}</p>
        <p><strong>Oggetto:</strong> ${escapeHtml(payload.subject.trim())}</p>
        <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f1f3ff">
          ${escapeHtml(payload.message.trim()).replaceAll("\n", "<br />")}
        </div>
        <p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
            Apri richiesta
          </a>
        </p>
      </div>
    `;

    await sendTransactionalEmail({
      to: professional?.email,
      subject,
      text,
      html,
    });
  } catch (emailError) {
    console.error("[contact-requests] Failed to send professional email", emailError);
  }

  return NextResponse.json({
    request: created,
    conversation_id: conversation?.id ?? null,
  });
}
