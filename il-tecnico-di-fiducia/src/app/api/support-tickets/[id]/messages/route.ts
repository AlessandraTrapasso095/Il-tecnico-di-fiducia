import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { loadAdminUserSummaries } from "@/lib/server/admin-user-summaries";
import {
  configuredEmailFrom,
  maskEmailForLog,
  supportAdminEmail,
} from "@/lib/server/email";
import {
  sendGuestSupportTicketReplyEmail,
  sendGuestSupportTicketResolvedEmail,
  sendSupportTicketReplyEmail,
  sendSupportTicketUserReplyEmail,
} from "@/lib/server/support-ticket-emails";
import {
  combineNotificationDeliveryStates,
  getNotificationDeliveryState,
  logNotificationEmailDecision,
  offlineNotificationDeliveryState,
} from "@/lib/server/notification-delivery";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const SUPPORT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 5;

type SupportMessageAttachmentRow = {
  id: string;
  support_message_id: string;
  bucket_id: string;
  file_path: string;
  file_type: "image" | "video";
  mime_type: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

async function loadSignedSupportAttachments(messageIds: string[]) {
  const byMessage = new Map<string, Array<Record<string, unknown>>>();

  if (messageIds.length === 0) return byMessage;

  const service = createServiceClient();

  const { data, error } = await service
    .from("support_message_attachments")
    .select(
      "id, support_message_id, bucket_id, file_path, file_type, mime_type, file_name, file_size, created_at",
    )
    .in("support_message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as SupportMessageAttachmentRow[]) {
    const { data: signed, error: signedError } = await service.storage
      .from(row.bucket_id)
      .createSignedUrl(
        row.file_path,
        SUPPORT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
        { download: false },
      );

    if (signedError || !signed?.signedUrl) {
      logApiError("SUPPORT_MESSAGES ATTACHMENT SIGN ERROR", {
        query: "create support attachment signed url",
        message_id: row.support_message_id,
        error: signedError ?? new Error("Signed URL missing"),
      });
      continue;
    }

    const existing = byMessage.get(row.support_message_id) ?? [];

    existing.push({
      id: row.id,
      file_type: row.file_type,
      mime_type: row.mime_type,
      file_name: row.file_name,
      file_size: row.file_size,
      signed_url: signed.signedUrl,
      expires_at: new Date(
        Date.now() + SUPPORT_ATTACHMENT_SIGNED_URL_TTL_SECONDS * 1000,
      ).toISOString(),
      created_at: row.created_at,
    });

    byMessage.set(row.support_message_id, existing);
  }

  return byMessage;
}

type CreateSupportMessagePayload = {
  body: string;
  next_status?: "waiting" | "closed";
};

function maskId(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 12) return `${value.slice(0, 3)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logSupportTicketAdminReplyDelivery({
  ticketId,
  authorRole,
  recipientId,
  recipientType,
  recipientEmail,
  deliveryState,
  notificationAttempted,
  notificationCreated,
  emailAttempted,
  emailResult,
  errorStage = null,
  errorMessage: deliveryErrorMessage = null,
}: {
  ticketId: string;
  authorRole: string;
  recipientId: string;
  recipientType: string;
  recipientEmail: string | null | undefined;
  deliveryState: ReturnType<typeof offlineNotificationDeliveryState>;
  notificationAttempted: boolean;
  notificationCreated: boolean;
  emailAttempted: boolean;
  emailResult:
    | Awaited<ReturnType<typeof sendSupportTicketReplyEmail>>
    | null;
  errorStage?: string | null;
  errorMessage?: string | null;
}) {
  console.info("[support-ticket-delivery] Admin reply delivery", {
    ticket_id: maskId(ticketId),
    author_role: authorRole,
    recipient_id: maskId(recipientId),
    recipient_type: recipientType,
    recipient_email_present: Boolean(recipientEmail),
    recipient_email_masked: maskEmailForLog(recipientEmail),
    presence_source: deliveryState.signals.presenceSource,
    online: deliveryState.online,
    reason: deliveryState.reason,
    notification_attempted: notificationAttempted,
    notification_created: notificationCreated,
    email_required: deliveryState.emailRequired,
    email_attempted: emailAttempted,
    email_sent: emailResult?.sent === true,
    from_masked: maskEmailForLog(configuredEmailFrom()),
    reply_to_masked: maskEmailForLog(supportAdminEmail()),
    messageId: emailResult && "messageId" in emailResult ? emailResult.messageId ?? null : null,
    accepted: emailResult && "accepted" in emailResult ? emailResult.accepted ?? [] : [],
    rejected: emailResult && "rejected" in emailResult ? emailResult.rejected ?? [] : [],
    smtp_response: emailResult && "response" in emailResult ? emailResult.response ?? null : null,
    error_stage: errorStage,
    error_message: deliveryErrorMessage,
    signals: deliveryState.signals,
  });
}

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
    logApiError("SUPPORT_MESSAGES ERROR", {
      query: "support_tickets select for messages",
      ticket_id: ticketId,
      error: ticketError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare il ticket." },
      { status: 500 },
    );
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
    logApiError("SUPPORT_MESSAGES ERROR", {
      query: "support_messages select by ticket",
      ticket_id: ticketId,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare i messaggi del ticket." },
      { status: 500 },
    );
  }

  try {
    const messages = data ?? [];

    const attachmentsByMessage = await loadSignedSupportAttachments(
      messages.map((supportMessage) => supportMessage.id),
    );

    return NextResponse.json({
      messages: messages.map((supportMessage) => ({
        ...supportMessage,
        attachments: attachmentsByMessage.get(supportMessage.id) ?? [],
      })),
    });
  } catch (attachmentError) {
    logApiError("SUPPORT_MESSAGES ATTACHMENTS ERROR", {
      query: "load support message attachments",
      ticket_id: ticketId,
      error: attachmentError,
    });

    return NextResponse.json({
      messages: (data ?? []).map((supportMessage) => ({
        ...supportMessage,
        attachments: [],
      })),
    });
  }
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
    .select(
      "id, author_id, guest_first_name, guest_last_name, guest_email, subject, body, status, created_at, updated_at",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    logApiError("SUPPORT_MESSAGES ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "support_tickets select before reply",
      ticket_id: ticketId,
      error: ticketError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare il ticket." },
      { status: 500 },
    );
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
    logApiError("SUPPORT_MESSAGES ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "support_messages insert reply",
      ticket_id: ticketId,
      error,
    });
    return NextResponse.json(
      { error: "Si è verificato un problema durante l’invio della risposta." },
      { status: 400 },
    );
  }

  let updatedTicket = ticket;

  if (profile.role === "admin") {
    const nextStatus = payload.next_status ?? "waiting";
    const { data: statusTicket, error: statusError } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus })
      .eq("id", ticketId)
      .select(
      "id, author_id, guest_first_name, guest_last_name, guest_email, subject, body, status, created_at, updated_at",
    )
      .single();

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 });
    }

    updatedTicket = statusTicket;

    const isGuestTicket =
      updatedTicket.author_id === null &&
      Boolean(updatedTicket.guest_email);

    if (isGuestTicket && updatedTicket.guest_email) {
      try {
        if (nextStatus === "closed") {
          await sendGuestSupportTicketResolvedEmail({
            ticket: {
              ...updatedTicket,
              guest_email: updatedTicket.guest_email,
            },
            replyBody: payload.body.trim(),
          });
        } else {
          await sendGuestSupportTicketReplyEmail({
            ticket: {
              ...updatedTicket,
              guest_email: updatedTicket.guest_email,
            },
            replyBody: payload.body.trim(),
          });
        }
      } catch (emailError) {
        logApiError("SUPPORT_MESSAGES GUEST EMAIL ERROR", {
          user_id: user.id,
          role: profile.role,
          query: "send guest ticket reply email",
          ticket_id: ticketId,
          error: emailError,
        });
      }

      await writeAuditLog(supabase, {
        actorId: profile.id,
        action: "admin.reply_guest_support_ticket",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: { status: nextStatus },
      });

      return NextResponse.json({
        message: data,
        ticket: updatedTicket,
      });
    }

    await writeAuditLog(supabase, {
      actorId: profile.id,
      action: "admin.reply_support_ticket",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { status: nextStatus },
    });

    let service: ReturnType<typeof createServiceClient> | null = null;
    let notificationAttempted = false;
    let notificationCreated = false;
    let emailAttempted = false;
    let emailResult: Awaited<ReturnType<typeof sendSupportTicketReplyEmail>> | null = null;
    let errorStage: string | null = null;
    let deliveryErrorMessage: string | null = null;

    try {
      service = createServiceClient();
    } catch (serviceError) {
      errorStage = "service_client";
      deliveryErrorMessage = errorMessage(serviceError);
      logApiError("SUPPORT_MESSAGES DELIVERY ERROR", {
        user_id: user.id,
        role: profile.role,
        query: "create service client for admin ticket reply delivery",
        ticket_id: ticketId,
        error: serviceError,
      });
    }

    const authorsById = service
      ? await loadAdminUserSummaries(service, [updatedTicket.author_id]).catch(
          (authorError) => {
            errorStage = "recipient_lookup";
            deliveryErrorMessage = errorMessage(authorError);
            logApiError("SUPPORT_MESSAGES ENRICHMENT ERROR", {
              user_id: user.id,
              role: profile.role,
              query: "load support ticket author after admin reply",
              ticket_id: ticketId,
              recipient_id: updatedTicket.author_id,
              error: authorError,
            });
            return new Map();
          },
        )
      : new Map();
    const author = authorsById.get(updatedTicket.author_id) ?? null;
    const recipientType = author?.role ?? "unknown";
    const recipientEmail = author?.email ?? null;

    if (service) {
      notificationAttempted = true;
      try {
        const { error: notificationError } = await service.from("notifications").insert({
          recipient_id: updatedTicket.author_id,
          actor_id: profile.id,
          type: "support_ticket_replied",
          entity_type: "support_ticket",
          entity_id: updatedTicket.id,
        });

        if (notificationError) {
          errorStage = "notification";
          deliveryErrorMessage = notificationError.message;
          logApiError("SUPPORT_MESSAGES NOTIFICATION ERROR", {
            user_id: user.id,
            role: profile.role,
            query: "create ticket reply notification",
            ticket_id: ticketId,
            recipient_id: updatedTicket.author_id,
            error: notificationError,
          });
        } else {
          notificationCreated = true;
        }
      } catch (notificationError) {
        errorStage = "notification";
        deliveryErrorMessage = errorMessage(notificationError);
        logApiError("SUPPORT_MESSAGES NOTIFICATION ERROR", {
          user_id: user.id,
          role: profile.role,
          query: "create ticket reply notification",
          ticket_id: ticketId,
          recipient_id: updatedTicket.author_id,
          error: notificationError,
        });
      }
    }

    const deliveryState =
      service && author
        ? await getNotificationDeliveryState({
            service,
            recipientId: updatedTicket.author_id,
            recipientType: author.role,
            requireRealtimePresence: true,
          }).catch((presenceError) => {
            errorStage = "presence";
            deliveryErrorMessage = errorMessage(presenceError);
            logApiError("SUPPORT_MESSAGES PRESENCE ERROR", {
              user_id: user.id,
              role: profile.role,
              query: "check support ticket recipient presence",
              ticket_id: ticketId,
              recipient_id: updatedTicket.author_id,
              error: presenceError,
            });
            return offlineNotificationDeliveryState({
              recipientId: updatedTicket.author_id,
              recipientType: author.role,
              reason: "presence_check_exception_email_required",
            });
          })
        : offlineNotificationDeliveryState({
            recipientId: updatedTicket.author_id,
            recipientType,
            reason: service ? "recipient_profile_missing_email_required" : "service_client_unavailable_email_required",
          });

    if (deliveryState.emailRequired && author?.email) {
      emailAttempted = true;
      try {
        emailResult = await sendSupportTicketReplyEmail({
          ticket: updatedTicket,
          author,
          replyBody: payload.body.trim(),
        });
      } catch (emailError) {
        errorStage = "email";
        deliveryErrorMessage = errorMessage(emailError);
        logApiError("SUPPORT_MESSAGES EMAIL ERROR", {
          user_id: user.id,
          role: profile.role,
          query: "send ticket reply email",
          ticket_id: ticketId,
          recipient_id: updatedTicket.author_id,
          error: emailError,
        });
      }
    } else if (deliveryState.emailRequired && !author?.email) {
      errorStage = "recipient_email";
      deliveryErrorMessage = "Recipient email is missing";
      logApiError("SUPPORT_MESSAGES EMAIL ERROR", {
        user_id: user.id,
        role: profile.role,
        query: "resolve ticket recipient email",
        ticket_id: ticketId,
        recipient_id: updatedTicket.author_id,
        error: new Error("Recipient email is missing"),
      });
    }

    logSupportTicketAdminReplyDelivery({
      ticketId,
      authorRole: profile.role,
      recipientId: updatedTicket.author_id,
      recipientType,
      recipientEmail,
      deliveryState,
      notificationAttempted,
      notificationCreated,
      emailAttempted,
      emailResult,
      errorStage,
      errorMessage: deliveryErrorMessage,
    });
  } else {
    if (ticket.status !== "open") {
      const { data: statusTicket, error: statusError } = await supabase
        .from("support_tickets")
        .update({ status: "open" })
        .eq("id", ticketId)
        .eq("author_id", user.id)
        .select(
      "id, author_id, guest_first_name, guest_last_name, guest_email, subject, body, status, created_at, updated_at",
    )
        .single();

      if (statusError) {
        console.error("[support] Failed to reopen ticket after user reply", statusError);
      } else {
        updatedTicket = statusTicket;
      }
    }

    try {
      const service = createServiceClient();
      const [{ data: admins }, authorsById] = await Promise.all([
        service
          .from("profiles")
          .select("id, suspended_until")
          .eq("role", "admin")
          .eq("is_banned", false),
        loadAdminUserSummaries(service, [user.id]).catch((authorError) => {
          logApiError("SUPPORT_MESSAGES ENRICHMENT ERROR", {
            user_id: user.id,
            role: profile.role,
            query: "load support ticket reply author",
            ticket_id: ticketId,
            error: authorError,
          });
          return new Map();
        }),
      ]);
      const author = authorsById.get(user.id) ?? null;
      const activeAdminIds = (admins ?? [])
        .filter((admin) => {
          if (!admin.suspended_until) return true;
          return new Date(admin.suspended_until) <= new Date();
        })
        .map((admin) => admin.id);

      if (activeAdminIds.length > 0) {
        const { error: adminNotificationError } = await service.from("notifications").insert(
          activeAdminIds.map((adminId) => ({
            recipient_id: adminId,
            actor_id: user.id,
            type: "support_ticket_user_replied",
            entity_type: "support_ticket",
            entity_id: updatedTicket.id,
          })),
        );
        if (adminNotificationError) {
          logApiError("SUPPORT_MESSAGES NOTIFICATION ERROR", {
            user_id: user.id,
            role: profile.role,
            query: "create admin ticket reply notification",
            ticket_id: ticketId,
            recipient_count: activeAdminIds.length,
            error: adminNotificationError,
          });
        }
      }

      if (author) {
        const adminDeliveryStates = await Promise.all(
          activeAdminIds.map((adminId) =>
            getNotificationDeliveryState({
              service,
              recipientId: adminId,
              recipientType: "admin",
            }),
          ),
        );
        const deliveryState = combineNotificationDeliveryStates({
          recipientId:
            activeAdminIds.length > 0 ? activeAdminIds.join(",") : "support-admins",
          recipientType: "admin",
          states: adminDeliveryStates,
          fallbackReason: "no_active_admin_profiles_email_required",
        });

        if (!deliveryState.emailRequired) {
          logNotificationEmailDecision({
            scope: "support.ticket_user_reply",
            state: deliveryState,
          });
        } else {
          try {
            const emailResult = await sendSupportTicketUserReplyEmail({
              ticket: updatedTicket,
              author,
              replyBody: payload.body.trim(),
            });
            logNotificationEmailDecision({
              scope: "support.ticket_user_reply",
              state: deliveryState,
              emailResult,
            });
          } catch (emailError) {
            logNotificationEmailDecision({
              scope: "support.ticket_user_reply",
              state: deliveryState,
            });
            logApiError("SUPPORT_MESSAGES EMAIL ERROR", {
              user_id: user.id,
              role: profile.role,
              query: "send admin ticket reply email",
              ticket_id: ticketId,
              recipient_count: activeAdminIds.length,
              error: emailError,
            });
          }
        }
      }
    } catch (notificationError) {
      logApiError("SUPPORT_MESSAGES NOTIFICATION ERROR", {
        user_id: user.id,
        role: profile.role,
        query: "create admin ticket reply notification or email",
        ticket_id: ticketId,
        error: notificationError,
      });
    }
  }

  return NextResponse.json({ message: data, ticket: updatedTicket });
}
