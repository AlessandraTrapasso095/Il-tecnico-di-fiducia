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
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageAttachment, MessageRow } from "@/lib/types/chat";

type SendPayload = {
  body: string;
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
]);

const WORD_DOCUMENT_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
  if (!contentType && WORD_DOCUMENT_TYPES.has(file.type)) {
    const lowerName = file.name.toLowerCase();
    if (
      (file.type === "application/msword" && lowerName.endsWith(".doc")) ||
      (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        lowerName.endsWith(".docx"))
    ) {
      contentType = file.type;
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

async function notifyMessageRecipient({
  conversationId,
  senderId,
  body,
}: {
  conversationId: string;
  senderId: string;
  body: string | null;
}) {
  const service = createServiceClient();
  const conversation = await getConversationForSend(conversationId);
  if (!conversation) return;

  const recipientId =
    conversation.customer_id === senderId
      ? conversation.professional_id
      : conversation.customer_id;
  if (!recipientId || recipientId === senderId) return;

  const [{ data: active }, { data: activity }, { data: people }] = await Promise.all([
    service
      .from("conversation_active_presence")
      .select("active_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", recipientId)
      .maybeSingle(),
    service
      .from("user_activity")
      .select("last_seen_at")
      .eq("user_id", recipientId)
      .maybeSingle(),
    service
      .from("profiles")
      .select("id, email, role, first_name, last_name")
      .in("id", [senderId, recipientId]),
  ]);

  const activeWindowMs = 45 * 1000;
  const onlineWindowMs = 2 * 60 * 1000;
  const activeAt = active?.active_at ?? null;
  const lastSeenAt = activity?.last_seen_at ?? null;
  const recipientActiveInChat =
    activeAt !== null && Date.now() - new Date(activeAt).getTime() <= activeWindowMs;
  const recipientOnline =
    lastSeenAt !== null && Date.now() - new Date(lastSeenAt).getTime() <= onlineWindowMs;

  if (recipientActiveInChat) return;

  await service.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: senderId,
    type: "message_received",
    entity_type: "conversation",
    entity_id: conversationId,
  });

  if (recipientOnline) return;

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const sender = personById.get(senderId);
  const recipient = personById.get(recipientId);
  const senderName =
    `${sender?.first_name ?? ""} ${sender?.last_name ?? ""}`.trim() || "Un utente";
  const recipientName =
    `${recipient?.first_name ?? ""} ${recipient?.last_name ?? ""}`.trim() || "ciao";
  const baseUrl = appBaseUrl();
  const href =
    recipient?.role === "professional"
      ? `${baseUrl}/professionista/messaggi?conversation=${encodeURIComponent(conversationId)}`
      : `${baseUrl}/customer?section=messages&conversation=${encodeURIComponent(conversationId)}`;
  const preview = body?.trim() || "Ti ha inviato un allegato.";

  try {
    await sendTransactionalEmail({
      to: recipient?.email,
      subject: "Nuovo messaggio - Il Tecnico di Fiducia",
      text: [
        `Ciao ${recipientName},`,
        "",
        `${senderName} ti ha inviato un messaggio:`,
        preview,
        "",
        `Apri la chat: ${href}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Nuovo messaggio</h2>
          <p>Ciao ${escapeHtml(recipientName)},</p>
          <p><strong>${escapeHtml(senderName)}</strong> ti ha inviato un messaggio.</p>
          <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f1f3ff">
            ${escapeHtml(preview).replaceAll("\n", "<br />")}
          </div>
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri chat
            </a>
          </p>
        </div>
      `,
    });
  } catch (error) {
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

  const contentType = request.headers.get("content-type") ?? "";
  let body = "";
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    body = String(formData.get("body") ?? "").trim();
    files = formData.getAll("files").filter((item): item is File => item instanceof File);
  } else {
    let payload: SendPayload;
    try {
      payload = (await request.json()) as SendPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    body = String(payload.body ?? "").trim();
  }

  if (!body && files.length === 0) {
    return NextResponse.json(
      { error: "Message body or attachment is required" },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
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
        { error: "Unsupported file type (allowed: JPG/PNG/WebP/MP4/MOV/PDF/DOC/DOCX)" },
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
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
      return NextResponse.json({ error: attachmentError.message }, { status: 400 });
    }
  }

  const attachmentsByMessage = await signedAttachments(supabase, [data.id], {
    conversationId: id,
    userId: user.id,
    role: profile.role,
  });
  const message = {
    ...data,
    read_at: null,
    attachments: attachmentsByMessage.get(data.id) ?? [],
  };

  await notifyMessageRecipient({
    conversationId: id,
    senderId: user.id,
    body,
  });

  return NextResponse.json({ message });
}
