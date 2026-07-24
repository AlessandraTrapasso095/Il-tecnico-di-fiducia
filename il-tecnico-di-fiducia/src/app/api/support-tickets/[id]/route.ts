import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { logApiError } from "@/lib/server/api-logger";
import { loadAdminUserSummaries } from "@/lib/server/admin-user-summaries";
import {
  getNotificationDeliveryState,
  logNotificationEmailDecision,
} from "@/lib/server/notification-delivery";
import { sendSupportTicketResolvedEmail } from "@/lib/server/support-ticket-emails";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type UpdateTicketPayload = {
  subject?: string;
  body?: string;
  status?: "open" | "waiting" | "closed";
};

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
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

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logApiError("SUPPORT_TICKET_DETAIL ERROR", {
      query: "support_tickets select detail",
      ticket_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare il ticket." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let author = null;
  try {
    const service = createServiceClient();
    const authorsById = await loadAdminUserSummaries(service, [data.author_id]);
    author = authorsById.get(data.author_id) ?? null;
  } catch (authorError) {
    logApiError("SUPPORT_TICKET_DETAIL ENRICHMENT ERROR", {
      query: "load support ticket author",
      ticket_id: id,
      author_id: data.author_id,
      error: authorError,
    });
    author = null;
  }

  return NextResponse.json({ ticket: { ...data, author } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdateTicketPayload;
  try {
    payload = (await request.json()) as UpdateTicketPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isOptionalString(payload.subject) || !isOptionalString(payload.body)) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  if (payload.status && profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can change ticket status" },
      { status: 403 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (payload.subject !== undefined) updates.subject = payload.subject.trim();
  if (payload.body !== undefined) updates.body = payload.body.trim();
  if (payload.status) {
    if (!["open", "waiting", "closed"].includes(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = payload.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", id)
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .single();

  if (error) {
    logApiError("SUPPORT_TICKET_DETAIL ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "support_tickets update",
      ticket_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile aggiornare il ticket." },
      { status: 400 },
    );
  }

  if (profile.role === "admin" && payload.status) {
    await writeAuditLog(supabase, {
      actorId: profile.id,
      action: "admin.update_support_ticket",
      targetType: "support_ticket",
      targetId: id,
      metadata: { status: payload.status },
    });

    if (payload.status === "closed") {
      try {
        const service = createServiceClient();
        const authorsById = await loadAdminUserSummaries(service, [data.author_id]).catch(
          (authorError) => {
            logApiError("SUPPORT_TICKET_DETAIL ENRICHMENT ERROR", {
              user_id: user.id,
              role: profile.role,
              query: "load support ticket author after resolve",
              ticket_id: id,
              error: authorError,
            });
            return new Map();
          },
        );
        const author = authorsById.get(data.author_id) ?? null;

        const { error: notificationError } = await service.from("notifications").insert({
          recipient_id: data.author_id,
          actor_id: profile.id,
          type: "support_ticket_resolved",
          entity_type: "support_ticket",
          entity_id: data.id,
        });

        if (notificationError) {
          logApiError("SUPPORT_TICKET_DETAIL NOTIFICATION ERROR", {
            user_id: user.id,
            role: profile.role,
            query: "create ticket resolved notification",
            ticket_id: id,
            recipient_id: data.author_id,
            error: notificationError,
          });
        }

        if (author) {
          const deliveryState = await getNotificationDeliveryState({
            service,
            recipientId: data.author_id,
            recipientType: author.role,
          });
          if (!deliveryState.emailRequired) {
            logNotificationEmailDecision({
              scope: "support.ticket_resolved",
              state: deliveryState,
            });
          } else {
            try {
              const emailResult = await sendSupportTicketResolvedEmail({ ticket: data, author });
              logNotificationEmailDecision({
                scope: "support.ticket_resolved",
                state: deliveryState,
                emailResult,
              });
            } catch (emailError) {
              logNotificationEmailDecision({
                scope: "support.ticket_resolved",
                state: deliveryState,
              });
              logApiError("SUPPORT_TICKET_DETAIL EMAIL ERROR", {
                user_id: user.id,
                role: profile.role,
                query: "send ticket resolved email",
                ticket_id: id,
                error: emailError,
              });
            }
          }
        }
      } catch (notificationError) {
        logApiError("SUPPORT_TICKET_DETAIL NOTIFICATION ERROR", {
          user_id: user.id,
          role: profile.role,
          query: "create ticket resolved notification or email",
          ticket_id: id,
          error: notificationError,
        });
      }
    }
  }

  return NextResponse.json({ ticket: data });
}
