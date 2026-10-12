import { NextResponse, type NextRequest } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import {
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import {
  isNonEmptyString,
  sanitizeFileName,
} from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import {
  escapeHtml,
  sendTransactionalEmail,
  supportAdminEmail,
} from "@/lib/server/email";
import { guestAccessTokenMatches } from "@/lib/server/guest-support";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 5000;
const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 5;
const SUPPORT_BUCKET = "private-media";

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

type GuestAttachmentPayload = {
  bucket?: unknown;
  path?: unknown;
  file_name?: unknown;
  file_size?: unknown;
  mime_type?: unknown;
};

type GuestReplyPayload = {
  body?: unknown;
  attachments?: unknown;
};

type PreparedGuestAttachment = {
  path: string;
  fileName: string;
  fileSize: number;
  declaredMimeType: string;
};

type SupportAttachmentRow = {
  id: string;
  ticket_id: string;
  support_message_id: string;
  bucket_id: string;
  file_path: string;
  file_type: "image" | "video";
  mime_type: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

async function detectAttachmentMime(file: File) {
  const imageMime = await sniffImageMime(file);
  if (imageMime) return imageMime;

  const videoMime = await sniffIsoBmffVideoMime(file);
  if (videoMime) return videoMime;

  return null;
}

async function readStoredFileHeader({
  service,
  path,
}: {
  service: ReturnType<typeof createServiceClient>;
  path: string;
}) {
  const { data: signed, error: signedError } = await service.storage
    .from(SUPPORT_BUCKET)
    .createSignedUrl(path, 60, { download: false });

  if (signedError || !signed?.signedUrl) {
    throw signedError ?? new Error("Signed attachment URL missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(signed.signedUrl, {
      headers: {
        Range: "bytes=0-11",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Unable to read attachment header: HTTP ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength < 12) {
      throw new Error("Attachment header is incomplete");
    }

    return new Uint8Array(buffer.slice(0, 12));
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForStoredAttachment({
  service,
  path,
}: {
  service: ReturnType<typeof createServiceClient>;
  path: string;
}) {
  const attempts = 10;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await service.storage
      .from(SUPPORT_BUCKET)
      .info(path);

    if (!error && data) {
      return data;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 + attempt * 250),
      );
    }
  }

  return null;
}

async function detectStoredAttachmentMime({
  service,
  path,
  fileName,
}: {
  service: ReturnType<typeof createServiceClient>;
  path: string;
  fileName: string;
}) {
  const header = await readStoredFileHeader({
    service,
    path,
  });

  const headerFile = new File([header], fileName, {
    type: "application/octet-stream",
  });

  return detectAttachmentMime(headerFile);
}

function attachmentKind(mimeType: string): "image" | "video" {
  return mimeType.startsWith("video/") ? "video" : "image";
}

async function cleanupUploadedPaths(paths: string[]) {
  if (paths.length === 0) return;

  try {
    const service = createServiceClient();
    const { error } = await service.storage
      .from(SUPPORT_BUCKET)
      .remove(paths);

    if (error) {
      logApiError("PUBLIC_GUEST_SUPPORT ATTACHMENT CLEANUP ERROR", {
        query: "remove guest support attachment rollback files",
        error,
      });
    }
  } catch (error) {
    logApiError("PUBLIC_GUEST_SUPPORT ATTACHMENT CLEANUP ERROR", {
      query: "create service client for attachment rollback",
      error,
    });
  }
}

async function signedSupportAttachments({
  service,
  messageIds,
}: {
  service: ReturnType<typeof createServiceClient>;
  messageIds: string[];
}) {
  const byMessage = new Map<string, Array<Record<string, unknown>>>();

  if (messageIds.length === 0) return byMessage;

  const { data, error } = await service
    .from("support_message_attachments")
    .select(
      "id, ticket_id, support_message_id, bucket_id, file_path, file_type, mime_type, file_name, file_size, created_at",
    )
    .in("support_message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const row of (data ?? []) as SupportAttachmentRow[]) {
    const { data: signed, error: signedError } = await service.storage
      .from(row.bucket_id)
      .createSignedUrl(
        row.file_path,
        SIGNED_URL_TTL_SECONDS,
        { download: false },
      );

    if (signedError || !signed?.signedUrl) {
      logApiError("PUBLIC_GUEST_SUPPORT SIGNED URL ERROR", {
        query: "create guest support attachment signed url",
        ticket_id: row.ticket_id,
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
        Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      ).toISOString(),
      created_at: row.created_at,
    });

    byMessage.set(row.support_message_id, existing);
  }

  return byMessage;
}

async function loadGuestTicket({
  ticketId,
  token,
}: {
  ticketId: string;
  token: string;
}) {
  const service = createServiceClient();

  const { data: ticket, error } = await service
    .from("support_tickets")
    .select(
      "id, author_id, guest_first_name, guest_last_name, guest_email, guest_access_token_hash, subject, body, status, created_at, updated_at",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !ticket ||
    ticket.author_id !== null ||
    !ticket.guest_access_token_hash ||
    !guestAccessTokenMatches({
      token,
      expectedHash: ticket.guest_access_token_hash,
    })
  ) {
    return { service, ticket: null };
  }

  return { service, ticket };
}

function publicTicket(ticket: {
  id: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: ticket.id,
    first_name: ticket.guest_first_name,
    last_name: ticket.guest_last_name,
    email: ticket.guest_email,
    subject: ticket.subject.replace(/^Contatto pubblico:\s*/i, ""),
    body: ticket.body,
    status: ticket.status,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ticketId } = await params;
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!isNonEmptyString(ticketId) || !isNonEmptyString(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const ticketHash = await hashRateLimitId(
    `guest-ticket-read:${ticketId}:${ip}`,
  );

  const limited = await enforceRateLimit({
    key: `v1:guest-ticket:read:${ticketHash}`,
    maxHits: 60,
    windowSeconds: 300,
    errorMessage: "Troppe richieste. Riprova tra qualche minuto.",
  });

  if (limited) return limited;

  try {
    const { service, ticket } = await loadGuestTicket({
      ticketId,
      token,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await service
      .from("support_messages")
      .select("id, sender_role, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    const messageIds = (messages ?? []).map((message) => message.id);

    const attachmentsByMessage = await signedSupportAttachments({
      service,
      messageIds,
    });

    return NextResponse.json({
      ticket: publicTicket(ticket),
      messages: (messages ?? []).map((message) => ({
        ...message,
        attachments: attachmentsByMessage.get(message.id) ?? [],
      })),
    });
  } catch (error) {
    logApiError("PUBLIC_GUEST_SUPPORT GET ERROR", {
      query: "load guest support ticket",
      ticket_id: ticketId,
      error,
    });

    return NextResponse.json(
      { error: "Non è stato possibile caricare il ticket." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {

  const { id: ticketId } = await params;

  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!isNonEmptyString(ticketId) || !isNonEmptyString(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const replyHash = await hashRateLimitId(
    `guest-ticket-reply:${ticketId}:${ip}`,
  );

  const limited = await enforceRateLimit({
    key: `v1:guest-ticket:reply:${replyHash}`,
    maxHits: 10,
    windowSeconds: 300,
    errorMessage: "Troppe risposte. Riprova tra qualche minuto.",
  });

  if (limited) return limited;

  let payload: GuestReplyPayload;

  try {
    payload = (await request.json()) as GuestReplyPayload;
  } catch {
    return NextResponse.json(
      { error: "Formato richiesta non valido." },
      { status: 400 },
    );
  }

  const body =
    typeof payload.body === "string"
      ? payload.body.trim().slice(0, MAX_BODY_LENGTH)
      : "";

  if (!isNonEmptyString(body)) {
    return NextResponse.json(
      { error: "Scrivi un messaggio prima di inviare." },
      { status: 400 },
    );
  }

  const rawAttachments = Array.isArray(payload.attachments)
    ? (payload.attachments as GuestAttachmentPayload[])
    : [];


  if (rawAttachments.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Puoi allegare al massimo ${MAX_FILES} file.` },
      { status: 400 },
    );
  }

  const preparedAttachments: PreparedGuestAttachment[] = [];

  for (const item of rawAttachments) {
    const bucket =
      typeof item?.bucket === "string" ? item.bucket.trim() : "";

    const path =
      typeof item?.path === "string" ? item.path.trim() : "";

    const rawFileName =
      typeof item?.file_name === "string"
        ? item.file_name.trim()
        : "";

    const declaredMimeType =
      typeof item?.mime_type === "string"
        ? item.mime_type.trim().toLowerCase()
        : "";

    const fileSize =
      typeof item?.file_size === "number"
        ? item.file_size
        : Number(item?.file_size);

    const expectedPrefix =
      `support/${ticketId}/guest-upload/`;

    if (
      bucket !== SUPPORT_BUCKET ||
      !path.startsWith(expectedPrefix) ||
      path.includes("..")
    ) {
      return NextResponse.json(
        { error: "Riferimento allegato non valido." },
        { status: 400 },
      );
    }

    if (!rawFileName) {
      return NextResponse.json(
        { error: "Nome allegato non valido." },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      !Number.isInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE_BYTES
    ) {
      return NextResponse.json(
        { error: "Dimensione allegato non valida." },
        { status: 400 },
      );
    }

    if (!ALLOWED_ATTACHMENT_TYPES.has(declaredMimeType)) {
      return NextResponse.json(
        {
          error:
            "Formato non supportato. Puoi allegare immagini JPG, PNG, WebP oppure video MP4 e MOV.",
        },
        { status: 400 },
      );
    }

    preparedAttachments.push({
      path,
      fileName: sanitizeFileName(rawFileName),
      fileSize,
      declaredMimeType,
    });
  }

  let claimedTurn = false;
  let createdMessageId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    const { service, ticket } = await loadGuestTicket({
      ticketId,
      token,
    });


    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (ticket.status === "closed") {
      return NextResponse.json(
        {
          error:
            "Questo ticket è stato chiuso e non accetta altre risposte.",
        },
        { status: 409 },
      );
    }

    if (ticket.status !== "waiting") {
      if (preparedAttachments.length > 0) {
        await cleanupUploadedPaths(
          preparedAttachments.map((item) => item.path),
        );
      }

      return NextResponse.json(
        {
          error:
            "Hai già inviato la tua risposta. Attendi una nuova risposta dall'assistenza.",
        },
        { status: 409 },
      );
    }

    const detectedFiles: Array<{
      path: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      kind: "image" | "video";
    }> = [];

    for (const item of preparedAttachments) {

      const info = await waitForStoredAttachment({
        service,
        path: item.path,
      });


      if (!info) {
        await cleanupUploadedPaths(
          preparedAttachments.map((entry) => entry.path),
        );

        return NextResponse.json(
          { error: "Uno degli allegati non è disponibile." },
          { status: 400 },
        );
      }

      const actualSize =
        typeof info.size === "number" ? info.size : 0;

      if (
        actualSize <= 0 ||
        actualSize > MAX_FILE_SIZE_BYTES ||
        actualSize !== item.fileSize
      ) {
        await cleanupUploadedPaths(
          preparedAttachments.map((entry) => entry.path),
        );

        return NextResponse.json(
          { error: "Dimensione allegato non valida." },
          { status: 400 },
        );
      }

      const detectedMimeType =
        await detectStoredAttachmentMime({
          service,
          path: item.path,
          fileName: item.fileName,
        });


      if (
        !detectedMimeType ||
        !ALLOWED_ATTACHMENT_TYPES.has(detectedMimeType)
      ) {
        await cleanupUploadedPaths(
          preparedAttachments.map((entry) => entry.path),
        );

        return NextResponse.json(
          {
            error:
              "Formato non supportato. Puoi allegare immagini JPG, PNG, WebP oppure video MP4 e MOV.",
          },
          { status: 400 },
        );
      }

      detectedFiles.push({
        path: item.path,
        fileName: item.fileName,
        fileSize: actualSize,
        mimeType: detectedMimeType,
        kind: attachmentKind(detectedMimeType),
      });
    }

    // Claim atomico del turno guest.

    // Una sola richiesta può trasformare waiting -> open.
    const { data: claimedTicket, error: claimError } = await service
      .from("support_tickets")
      .update({ status: "open" })
      .eq("id", ticket.id)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();

    if (claimError) {
      throw claimError;
    }

    if (!claimedTicket) {
      return NextResponse.json(
        {
          error:
            "Hai già inviato la tua risposta. Attendi una nuova risposta dall'assistenza.",
        },
        { status: 409 },
      );
    }

    claimedTurn = true;


    const { data: message, error: messageError } = await service
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: null,
        sender_role: "guest",
        body,
      })
      .select("id, sender_role, body, created_at")
      .single();

    if (messageError) {
      throw messageError;
    }

    createdMessageId = message.id;


    const attachmentRows: Array<{
      ticket_id: string;
      support_message_id: string;
      uploader_id: null;
      uploader_role: "guest";
      bucket_id: string;
      file_path: string;
      file_type: "image" | "video";
      mime_type: string;
      file_name: string;
      file_size: number;
    }> = [];

    for (const item of detectedFiles) {
      uploadedPaths.push(item.path);

      attachmentRows.push({
        ticket_id: ticket.id,
        support_message_id: message.id,
        uploader_id: null,
        uploader_role: "guest",
        bucket_id: SUPPORT_BUCKET,
        file_path: item.path,
        file_type: item.kind,
        mime_type: item.mimeType,
        file_name: item.fileName,
        file_size: item.fileSize,
      });
    }

    if (attachmentRows.length > 0) {

      const { error: attachmentError } = await service
        .from("support_message_attachments")
        .insert(attachmentRows);

      if (attachmentError) {
        throw attachmentError;
      }
    }

    const attachmentsByMessage = await signedSupportAttachments({
      service,
      messageIds: [message.id],
    });


    const publicMessage = {
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    };

    try {
      const adminUrl =
        `${request.nextUrl.origin}/admin/supporto?ticket=${ticket.id}`;

      const attachmentSummary =
        detectedFiles.length > 0
          ? `Allegati: ${detectedFiles.length}`
          : null;

      await sendTransactionalEmail({
        to: supportAdminEmail(),
        subject: "Nuova risposta a un ticket pubblico",
        text: [
          "È arrivata una nuova risposta a un ticket pubblico.",
          "",
          `Utente: ${`${ticket.guest_first_name ?? ""} ${ticket.guest_last_name ?? ""}`.trim()}`,
          `Email: ${ticket.guest_email ?? "Non disponibile"}`,
          `Ticket: ${ticket.id}`,
          `Risposta: ${body}`,
          ...(attachmentSummary ? [attachmentSummary] : []),
          "",
          `Apri supporto admin: ${adminUrl}`,
        ].join("\n"),
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
            <h2 style="color:#002654">Nuova risposta a un ticket pubblico</h2>

            <p>
              <strong>Utente:</strong>
              ${escapeHtml(
                `${ticket.guest_first_name ?? ""} ${ticket.guest_last_name ?? ""}`.trim(),
              )}
            </p>

            <p>
              <strong>Email:</strong>
              ${escapeHtml(ticket.guest_email ?? "Non disponibile")}
            </p>

            <div style="background:#f1f3ff;border-radius:16px;padding:16px;margin:16px 0">
              ${escapeHtml(body).replaceAll("\n", "<br>")}
            </div>

            ${
              attachmentSummary
                ? `<p><strong>${escapeHtml(attachmentSummary)}</strong></p>`
                : ""
            }

            <p>
              <a
                href="${escapeHtml(adminUrl)}"
                style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700"
              >
                Apri supporto admin
              </a>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      logApiError("PUBLIC_GUEST_SUPPORT ADMIN EMAIL ERROR", {
        query: "notify admin of guest support reply",
        ticket_id: ticket.id,
        error: emailError,
      });
    }

    return NextResponse.json({
      ok: true,
      message: publicMessage,
      ticket_status: "open",
    });
  } catch (error) {
    logApiError("PUBLIC_GUEST_SUPPORT POST ERROR", {
      query: "create guest support reply with attachments",
      ticket_id: ticketId,
      message_id: createdMessageId,
      error,
    });

    await cleanupUploadedPaths(uploadedPaths);

    try {
      const service = createServiceClient();

      if (createdMessageId) {
        await service
          .from("support_messages")
          .delete()
          .eq("id", createdMessageId)
          .eq("ticket_id", ticketId);
      }

      if (claimedTurn) {
        await service
          .from("support_tickets")
          .update({ status: "waiting" })
          .eq("id", ticketId)
          .eq("status", "open");
      }
    } catch (rollbackError) {
      logApiError("PUBLIC_GUEST_SUPPORT ROLLBACK ERROR", {
        query: "rollback guest support failed send",
        ticket_id: ticketId,
        message_id: createdMessageId,
        error: rollbackError,
      });
    }

    return NextResponse.json(
      { error: "Non è stato possibile inviare la risposta." },
      { status: 500 },
    );
  }
}
