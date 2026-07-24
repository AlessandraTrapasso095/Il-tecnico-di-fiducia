import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isPdfFile,
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import { requireAuth } from "@/lib/api/auth";
import { clampInt, sanitizeFileName } from "@/lib/api/validation";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
} from "@/lib/server/email";
import {
  getNotificationDeliveryState,
  logNotificationEmailDecision,
} from "@/lib/server/notification-delivery";
import { isProfessionalVisibleToCustomers } from "@/lib/server/professional-visibility";
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageAttachment, MessageRow } from "@/lib/types/chat";

type SendPayload = {
  body: string;
};

type MessageSendLogContext = {
  conversationId: string;
  userId: string;
  role: string;
  hasText?: boolean;
  bodyLength?: number;
  attachmentCount?: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 5;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
]);

const EXTENSION_DOCUMENT_TYPES = new Map([
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".zip", "application/zip"],
]);

function fileKind(mimeType: string): "image" | "video" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

function isMissingColumnError(error: unknown, column: string) {
  const maybeError = error as { code?: string; message?: string; details?: string } | null;
  const haystack = `${maybeError?.message ?? ""} ${maybeError?.details ?? ""}`.toLowerCase();
  return (
    maybeError?.code === "42703" ||
    maybeError?.code === "PGRST204" ||
    haystack.includes(column.toLowerCase())
  );
}

function errorDetails(error: unknown) {
  const maybe = error as
    | {
        name?: string;
        code?: string;
        status?: number | string;
        message?: string;
        details?: string;
        hint?: string;
        stack?: string;
      }
    | null
    | undefined;

  if (!maybe || typeof maybe !== "object") {
    return { message: String(error) };
  }

  return {
    name: maybe.name,
    code: maybe.code,
    status: maybe.status,
    message: maybe.message,
    details: maybe.details,
    hint: maybe.hint,
    stack: maybe.stack,
  };
}

function logMessageSend(stage: string, context: MessageSendLogContext, extra?: unknown) {
  console.info("[messages] POST debug", {
    stage,
    ...context,
    ...(extra ? { extra } : {}),
  });
}

function logMessageSendError(stage: string, context: MessageSendLogContext, error: unknown) {
  console.error("[messages] POST failed", {
    stage,
    ...context,
    error: errorDetails(error),
  });
}

function logMessageLoadError(
  stage: string,
  context: {
    conversationId: string;
    userId: string;
    role: string;
    table: string;
  },
  error: unknown,
) {
  console.error("[messages] Failed during message load", {
    stage,
    ...context,
    error,
  });
}

async function detectMime(file: File) {
  let contentType: string | null = await sniffImageMime(file);
  if (!contentType) contentType = await sniffIsoBmffVideoMime(file);
  if (!contentType && (await isPdfFile(file))) contentType = "application/pdf";
  if (!contentType) {
    const lowerName = file.name.toLowerCase();
    const extensionEntry = Array.from(EXTENSION_DOCUMENT_TYPES.entries()).find(
      ([extension]) => lowerName.endsWith(extension),
    );
    const extensionMimeType = extensionEntry?.[1] ?? null;
    if (
      extensionMimeType &&
      (!file.type || file.type === extensionMimeType || ALLOWED_ATTACHMENT_TYPES.has(file.type))
    ) {
      contentType = file.type && ALLOWED_ATTACHMENT_TYPES.has(file.type) ? file.type : extensionMimeType;
    }
  }
  return contentType ?? file.type ?? null;
}

async function signedAttachments(
  supabase: SupabaseClient,
  messageIds: string[],
  context: { conversationId: string; userId: string; role: string },
) {
  if (messageIds.length === 0) return new Map<string, MessageAttachment[]>();

  const { data, error } = await supabase
    .from("message_attachments")
    .select(
      "id, message_id, conversation_id, bucket_id, file_path, file_type, mime_type, file_name, file_size, created_at",
    )
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    logMessageLoadError(
      "attachments_select",
      { ...context, table: "message_attachments" },
      error,
    );
    return new Map<string, MessageAttachment[]>();
  }

  const byMessage = new Map<string, MessageAttachment[]>();
  const signingClient = createServiceClient();

  for (const row of data ?? []) {
    const { data: signed, error: signedUrlError } = await signingClient.storage
      .from(row.bucket_id)
      .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS, { download: false });

    if (signedUrlError) {
      logMessageLoadError(
        "attachment_signed_url",
        { ...context, table: "storage.objects" },
        signedUrlError,
      );
    }

    if (!signed?.signedUrl) continue;

    const existing = byMessage.get(row.message_id) ?? [];
    existing.push({
      id: row.id,
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      bucket_id: row.bucket_id,
      file_path: row.file_path,
      file_type: row.file_type as MessageAttachment["file_type"],
      mime_type: row.mime_type,
      file_name: row.file_name,
      file_size: row.file_size,
      signed_url: signed.signedUrl,
      expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      created_at: row.created_at,
    });
    byMessage.set(row.message_id, existing);
  }

  return byMessage;
}

async function getConversationForSend(conversationId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("conversations")
    .select("id, request_id, customer_id, professional_id, status")
    .eq("id", conversationId)
    .maybeSingle();
  return data ?? null;
}

function canAccessConversation(
  conversation: Awaited<ReturnType<typeof getConversationForSend>>,
  userId: string,
  role: string,
) {
  if (!conversation) return false;
  if (role === "admin") return true;
  return conversation.customer_id === userId || conversation.professional_id === userId;
}

async function notifyMessageRecipient({
  conversationId,
  senderId,
}: {
  conversationId: string;
  senderId: string;
}) {
  const service = createServiceClient();
  const conversation = await getConversationForSend(conversationId);
  if (!conversation) return;

  const recipientId =
    conversation.customer_id === senderId
      ? conversation.professional_id
      : conversation.customer_id;
  if (!recipientId || recipientId === senderId) return;

  const { data: people, error: peopleError } = await service
    .from("profiles")
    .select("id, email, role, first_name, last_name")
    .in("id", [senderId, recipientId]);

  if (peopleError) {
    console.error("[messages] Failed to load message notification profiles", {
      conversationId,
      senderId,
      recipientId,
      error: errorDetails(peopleError),
    });
  }

  const { data: existingNotification, error: existingNotificationError } = await service
    .from("notifications")
    .select("id")
    .eq("recipient_id", recipientId)
    .eq("actor_id", senderId)
    .eq("type", "message_received")
    .eq("entity_type", "conversation")
    .eq("entity_id", conversationId)
    .is("read_at", null)
    .maybeSingle();

  if (existingNotificationError) {
    console.error("[messages] Failed to check existing message notification", {
      conversationId,
      senderId,
      recipientId,
      error: errorDetails(existingNotificationError),
    });
  }

  const { error: notificationError } = existingNotification?.id
    ? { error: null }
    : await service.from("notifications").insert({
        recipient_id: recipientId,
        actor_id: senderId,
        type: "message_received",
        entity_type: "conversation",
        entity_id: conversationId,
      });

  if (notificationError) {
    console.error("[messages] Failed to create message notification", {
      conversationId,
      senderId,
      recipientId,
      error: errorDetails(notificationError),
    });
  }

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const sender = personById.get(senderId);
  const recipient = personById.get(recipientId);
  const deliveryState = await getNotificationDeliveryState({
    service,
    recipientId,
    recipientType: recipient?.role ?? "unknown",
    activeConversationId: conversationId,
  });

  if (!deliveryState.emailRequired) {
    logNotificationEmailDecision({
      scope: "messages.message_received",
      state: deliveryState,
    });
    return;
  }

  const senderName =
    `${sender?.first_name ?? ""} ${sender?.last_name ?? ""}`.trim() || "Un utente";
  const recipientName =
    `${recipient?.first_name ?? ""} ${recipient?.last_name ?? ""}`.trim() || "ciao";
  const baseUrl = appBaseUrl();
  const href =
    recipient?.role === "professional"
      ? `${baseUrl}/professionista/messaggi?conversation=${encodeURIComponent(conversationId)}`
      : `${baseUrl}/customer?section=messages&conversation=${encodeURIComponent(conversationId)}`;
  try {
    const emailResult = await sendTransactionalEmail({
      to: recipient?.email,
      subject: "Nuovo messaggio - Il Tecnico di Fiducia",
      text: [
        `Ciao ${recipientName},`,
        "",
        `${senderName} ti ha inviato un nuovo messaggio sulla piattaforma.`,
        "",
        `Apri la chat: ${href}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Nuovo messaggio</h2>
          <p>Ciao ${escapeHtml(recipientName)},</p>
          <p><strong>${escapeHtml(senderName)}</strong> ti ha inviato un messaggio.</p>
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri chat
            </a>
          </p>
        </div>
      `,
    });
    logNotificationEmailDecision({
      scope: "messages.message_received",
      state: deliveryState,
      emailResult,
    });
  } catch (error) {
    logNotificationEmailDecision({
      scope: "messages.message_received",
      state: deliveryState,
    });
    console.error("[messages] Failed to send offline message email", error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!UUID_PATTERN.test(id)) {
    console.error("[messages] Invalid conversation id", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const limit = clampInt(request.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const logContext = {
    conversationId: id,
    userId: user.id,
    role: profile.role,
  };

  const conversation = await getConversationForSend(id);
  if (!conversation) {
    console.error("[messages] Conversation not found", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!canAccessConversation(conversation, user.id, profile.role)) {
    console.error("[messages] Forbidden conversation read", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  let { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, read_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logMessageLoadError(
      "messages_select_with_read_at",
      { ...logContext, table: "messages" },
      error,
    );

    if (isMissingColumnError(error, "read_at")) {
      const fallback = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(limit);

      data = fallback.data?.map((message) => ({ ...message, read_at: null })) ?? null;
      error = fallback.error;

      if (error) {
        logMessageLoadError(
          "messages_select_base",
          { ...logContext, table: "messages" },
          error,
        );
      }
    }
  }

  if (error) {
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }

  const messages = (data ?? []) as MessageRow[];
  const attachmentsByMessage = await signedAttachments(
    supabase,
    messages.map((message) => message.id),
    logContext,
  );

  return NextResponse.json({
    messages: messages.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    })),
  });
}

export async function POST(
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
  if (!UUID_PATTERN.test(id)) {
    console.error("[messages] Invalid conversation id for send", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const logContext: MessageSendLogContext = {
    conversationId: id,
    userId: user.id,
    role: profile.role,
  };

  try {
  const contentType = request.headers.get("content-type") ?? "";
  let body = "";
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logMessageSendError("parse_form_data", logContext, error);
      return NextResponse.json({ error: "Invalid multipart payload" }, { status: 400 });
    }
    body = String(formData.get("body") ?? "").trim();
    files = formData.getAll("files").filter((item): item is File => item instanceof File);
  } else {
    let payload: SendPayload;
    try {
      payload = (await request.json()) as SendPayload;
    } catch (error) {
      logMessageSendError("parse_json", logContext, error);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    body = String(payload.body ?? "").trim();
  }

  logContext.hasText = body.length > 0;
  logContext.bodyLength = body.length;
  logContext.attachmentCount = files.length;
  logMessageSend("payload_received", logContext, {
    contentType: contentType.split(";")[0],
    files: files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  });

  if (!body && files.length === 0) {
    return NextResponse.json(
      { error: "Message body or attachment is required" },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });
  }

  const conversation = await getConversationForSend(id);
  if (!conversation) {
    console.error("[messages] Conversation not found for send", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!canAccessConversation(conversation, user.id, profile.role)) {
    console.error("[messages] Forbidden conversation send", {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await isProfessionalVisibleToCustomers(conversation.professional_id))) {
    return NextResponse.json(
      { error: "Chat unavailable: professional subscription is not active" },
      { status: 403 },
    );
  }

  if (conversation.status !== "accepted") {
    return NextResponse.json(
      { error: "Chat is available only after the request is accepted" },
      { status: 403 },
    );
  }

  const detectedFiles: { file: File; mimeType: string; kind: "image" | "video" | "document" }[] =
    [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Max file size is 50MB" }, { status: 400 });
    }

    const mimeType = await detectMime(file);
    if (!mimeType || !ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type (allowed: JPG/PNG/WebP/MP4/MOV/PDF/DOC/DOCX/XLS/XLSX/ZIP)" },
        { status: 400 },
      );
    }

    detectedFiles.push({ file, mimeType, kind: fileKind(mimeType) });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: user.id,
      body: body || null,
    })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();

  if (error) {
    logMessageSendError("messages_insert", logContext, error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 },
    );
  }

  logMessageSend("message_inserted", logContext, { messageId: data.id });

  const uploadedRows = [];
  const storageClient = createServiceClient();

  for (const item of detectedFiles) {
    const safeName = sanitizeFileName(item.file.name || "attachment");
    const path = `${user.id}/messages/${data.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await storageClient.storage
      .from("private-media")
      .upload(path, item.file, {
        upsert: false,
        contentType: item.mimeType,
        cacheControl: "3600",
      });

    if (uploadError) {
      logMessageSendError("storage_upload", logContext, uploadError);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 },
      );
    }

    uploadedRows.push({
      message_id: data.id,
      conversation_id: id,
      uploader_id: user.id,
      bucket_id: "private-media",
      file_path: path,
      file_type: item.kind,
      mime_type: item.mimeType,
      file_name: safeName,
      file_size: item.file.size,
    });
  }

  if (uploadedRows.length > 0) {
    const { error: attachmentError } = await supabase
      .from("message_attachments")
      .insert(uploadedRows);

    if (attachmentError) {
      logMessageSendError("message_attachments_insert", logContext, attachmentError);
      return NextResponse.json(
        { error: "Failed to save message attachment" },
        { status: 500 },
      );
    }
  }

  let attachmentsByMessage = new Map<string, MessageAttachment[]>();
  try {
    attachmentsByMessage = await signedAttachments(supabase, [data.id], {
      conversationId: id,
      userId: user.id,
      role: profile.role,
    });
  } catch (error) {
    logMessageSendError("signed_attachments_non_blocking", logContext, error);
  }
  const message = {
    ...data,
    read_at: null,
    attachments: attachmentsByMessage.get(data.id) ?? [],
  };

  try {
    await notifyMessageRecipient({
      conversationId: id,
      senderId: user.id,
    });
  } catch (error) {
    logMessageSendError("notify_recipient_non_blocking", logContext, error);
  }

  return NextResponse.json({ message });
  } catch (error) {
    logMessageSendError("unexpected", logContext, error);
    return NextResponse.json(
      { error: "Internal message send error" },
      { status: 500 },
    );
  }
}
