import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";
import {
  loadAdminUserSummaries,
  type AdminUserSummary,
} from "@/lib/server/admin-user-summaries";
import { logApiError } from "@/lib/server/api-logger";
import { sendSupportTicketCreatedEmail } from "@/lib/server/support-ticket-emails";
import { createServiceClient } from "@/lib/supabase/service";

type CreateTicketPayload = {
  subject: string;
  body: string;
};

function summaryFromProfile(profile: {
  id: string;
  role: "customer" | "professional" | "admin";
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  suspended_until: string | null;
}): AdminUserSummary {
  const now = new Date().toISOString();
  return {
    id: profile.id,
    role: profile.role,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
    province_code: profile.province_code,
    phone: profile.phone,
    must_change_password: profile.must_change_password,
    is_banned: profile.is_banned,
    suspended_until: profile.suspended_until,
    created_at: now,
    updated_at: now,
    avatar_url: null,
    activity: null,
    subscription: null,
    professional_directory: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

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
    logApiError("SUPPORT_TICKETS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "support_tickets select list",
      status_filter: status,
      page,
      page_size: pageSize,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare i ticket supporto." },
      { status: 500 },
    );
  }

  const tickets = data ?? [];
  const authorIds = tickets.map((ticket) => ticket.author_id);
  const ticketIds = tickets.map((ticket) => ticket.id);
  let authorsById = new Map<string, AdminUserSummary>();
  try {
    const service = createServiceClient();
    authorsById = await loadAdminUserSummaries(service, authorIds);
  } catch (authorError) {
    logApiError("SUPPORT_TICKETS ENRICHMENT ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "load support ticket authors",
      author_count: authorIds.length,
      error: authorError,
    });
    if (authorIds.includes(user.id)) {
      authorsById.set(user.id, summaryFromProfile(profile));
    }
  }
  const lastMessageByTicketId = new Map<
    string,
    {
      id: string;
      ticket_id: string;
      sender_id: string | null;
      sender_role: string;
      body: string;
      created_at: string;
    }
  >();

  if (ticketIds.length > 0) {
    const { data: latestMessages, error: latestMessagesError } = await supabase
      .from("support_messages")
      .select("id, ticket_id, sender_id, sender_role, body, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: false });

    if (latestMessagesError) {
      logApiError("SUPPORT_TICKETS ENRICHMENT ERROR", {
        user_id: user.id,
        role: profile.role,
        query: "support_messages select latest by ticket ids",
        ticket_count: ticketIds.length,
        error: latestMessagesError,
      });
    } else {
      for (const message of latestMessages ?? []) {
        if (!lastMessageByTicketId.has(message.ticket_id)) {
          lastMessageByTicketId.set(message.ticket_id, message);
        }
      }
    }
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    tickets: tickets.map((ticket) => ({
      ...ticket,
      author: authorsById.get(ticket.author_id) ?? null,
      last_message: lastMessageByTicketId.get(ticket.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

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
    logApiError("SUPPORT_TICKETS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "support_tickets insert",
      error,
    });
    return NextResponse.json(
      { error: "Si è verificato un problema durante l’invio del ticket." },
      { status: 400 },
    );
  }

  let author: AdminUserSummary | null = summaryFromProfile(profile);
  try {
    const service = createServiceClient();
    const authorsById = await loadAdminUserSummaries(service, [user.id]);
    author = authorsById.get(user.id) ?? author;
  } catch (authorError) {
    logApiError("SUPPORT_TICKETS ENRICHMENT ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "load created support ticket author",
      error: authorError,
    });
  }

  if (author) {
    try {
      await sendSupportTicketCreatedEmail({ ticket: data, author });
    } catch (emailError) {
      logApiError("SUPPORT_TICKETS EMAIL ERROR", {
        user_id: user.id,
        role: profile.role,
        query: "send support ticket created email",
        ticket_id: data.id,
        error: emailError,
      });
    }
  }

  return NextResponse.json({ ticket: { ...data, author } });
}
