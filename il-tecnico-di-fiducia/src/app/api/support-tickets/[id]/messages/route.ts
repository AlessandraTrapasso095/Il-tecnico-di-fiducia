import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { loadAdminUserSummaries } from "@/lib/server/admin-user-summaries";
import {
  sendSupportTicketReplyEmail,
  sendSupportTicketUserReplyEmail,
} from "@/lib/server/support-ticket-emails";
import { createServiceClient } from "@/lib/supabase/service";

type CreateSupportMessagePayload = {
  body: string;
  next_status?: "waiting" | "closed";
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: ticketId } = await params;
  if (!isNonEmptyString(ticketId)) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_id, sender_role, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load support messages" },
      { status: 500 },
    );
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id: ticketId } = await params;
  if (!isNonEmptyString(ticketId)) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  let payload: CreateSupportMessagePayload;
  try {
    payload = (await request.json()) as CreateSupportMessagePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (
    payload.next_status !== undefined &&
    payload.next_status !== "waiting" &&
    payload.next_status !== "closed"
  ) {
    return NextResponse.json({ error: "Invalid next_status" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (profile.role !== "admin" && ticket.author_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (ticket.status === "closed") {
    return NextResponse.json(
      { error: "Cannot reply to a closed ticket" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: profile.role,
      body: payload.body.trim(),
    })
    .select("id, ticket_id, sender_id, sender_role, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let updatedTicket = ticket;

  if (profile.role === "admin") {
    const nextStatus = payload.next_status ?? "waiting";
    const { data: statusTicket, error: statusError } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus })
      .eq("id", ticketId)
      .select("id, author_id, subject, body, status, created_at, updated_at")
      .single();

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 });
    }

    updatedTicket = statusTicket;

    await writeAuditLog(supabase, {
      actorId: profile.id,
      action: "admin.reply_support_ticket",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { status: nextStatus },
    });

    const service = createServiceClient();
    const authorsById = await loadAdminUserSummaries(service, [updatedTicket.author_id]).catch(
      () => new Map(),
    );
    const author = authorsById.get(updatedTicket.author_id) ?? null;

    try {
      await service.from("notifications").insert({
        recipient_id: updatedTicket.author_id,
        actor_id: profile.id,
        type: "support_ticket_replied",
        entity_type: "support_ticket",
        entity_id: updatedTicket.id,
      });
    } catch (err) {
      console.error("[support] Failed to create ticket reply notification", err);
    }

    if (author) {
      try {
        await sendSupportTicketReplyEmail({
          ticket: updatedTicket,
          author,
          replyBody: payload.body.trim(),
        });
      } catch (err) {
        console.error("[support] Failed to send ticket reply email", err);
      }
    }
  } else {
    const service = createServiceClient();

    if (ticket.status !== "open") {
      const { data: statusTicket, error: statusError } = await service
        .from("support_tickets")
        .update({ status: "open" })
        .eq("id", ticketId)
        .eq("author_id", user.id)
        .select("id, author_id, subject, body, status, created_at, updated_at")
        .single();

      if (statusError) {
        console.error("[support] Failed to reopen ticket after user reply", statusError);
      } else {
        updatedTicket = statusTicket;
      }
    }

    const [{ data: admins }, authorsById] = await Promise.all([
      service
        .from("profiles")
        .select("id, suspended_until")
        .eq("role", "admin")
        .eq("is_banned", false),
      loadAdminUserSummaries(service, [user.id]).catch(() => new Map()),
    ]);
    const author = authorsById.get(user.id) ?? null;
    const activeAdminIds = (admins ?? [])
      .filter((admin) => {
        if (!admin.suspended_until) return true;
        return new Date(admin.suspended_until) <= new Date();
      })
      .map((admin) => admin.id);

    if (activeAdminIds.length > 0) {
      try {
        await service.from("notifications").insert(
          activeAdminIds.map((adminId) => ({
            recipient_id: adminId,
            actor_id: user.id,
            type: "support_ticket_user_replied",
            entity_type: "support_ticket",
            entity_id: updatedTicket.id,
          })),
        );
      } catch (err) {
        console.error("[support] Failed to create admin ticket reply notification", err);
      }
    }

    if (author) {
      try {
        await sendSupportTicketUserReplyEmail({
          ticket: updatedTicket,
          author,
          replyBody: payload.body.trim(),
        });
      } catch (err) {
        console.error("[support] Failed to send admin ticket reply email", err);
      }
    }
  }

  return NextResponse.json({ message: data, ticket: updatedTicket });
}
