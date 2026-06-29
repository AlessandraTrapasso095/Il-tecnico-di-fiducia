import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";
import { loadAdminUserSummaries } from "@/lib/server/admin-user-summaries";
import { sendSupportTicketCreatedEmail } from "@/lib/server/support-ticket-emails";
import { createServiceClient } from "@/lib/supabase/service";

type CreateTicketPayload = {
  subject: string;
  body: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 20, 1, 100);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let builder = supabase
    .from("support_tickets")
    .select("id, author_id, subject, body, status, created_at, updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (status) {
    builder = builder.eq("status", status);
  }

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load support tickets" },
      { status: 500 },
    );
  }

  const tickets = data ?? [];
  const authorIds = tickets.map((ticket) => ticket.author_id);
  const service = createServiceClient();
  let authorsById: Awaited<ReturnType<typeof loadAdminUserSummaries>>;
  try {
    authorsById = await loadAdminUserSummaries(service, authorIds);
  } catch {
    authorsById = new Map();
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    tickets: tickets.map((ticket) => ({
      ...ticket,
      author: authorsById.get(ticket.author_id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: CreateTicketPayload;
  try {
    payload = (await request.json()) as CreateTicketPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.subject) || !isNonEmptyString(payload.body)) {
    return NextResponse.json(
      { error: "subject and body are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      author_id: user.id,
      subject: payload.subject.trim(),
      body: payload.body.trim(),
      status: "open",
    })
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const service = createServiceClient();
  let author = null;
  try {
    const authorsById = await loadAdminUserSummaries(service, [user.id]);
    author = authorsById.get(user.id) ?? null;
  } catch (err) {
    console.error("[support] Failed to enrich ticket author", err);
  }

  if (author) {
    try {
      await sendSupportTicketCreatedEmail({ ticket: data, author });
    } catch (err) {
      console.error("[support] Failed to send admin ticket email", err);
    }
  }

  return NextResponse.json({ ticket: { ...data, author } });
}
