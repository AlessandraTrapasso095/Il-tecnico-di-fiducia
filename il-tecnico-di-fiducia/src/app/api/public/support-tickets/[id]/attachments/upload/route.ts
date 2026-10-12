import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { sanitizeFileName } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { guestAccessTokenMatches } from "@/lib/server/guest-support";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const SUPPORT_BUCKET = "private-media";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

type UploadRequestPayload = {
  file_name?: unknown;
  file_size?: unknown;
  mime_type?: unknown;
};

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
      "id, guest_access_token_hash, status",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !ticket ||
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

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id: ticketId } = await context.params;
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!ticketId || !token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rateHash = await hashRateLimitId(
    `guest-ticket-upload:${ticketId}:${ip}`,
  );

  const limited = await enforceRateLimit({
    key: `v1:guest-ticket:upload:${rateHash}`,
    maxHits: 20,
    windowSeconds: 300,
    errorMessage: "Troppi tentativi di caricamento. Riprova tra qualche minuto.",
  });

  if (limited) return limited;

  let payload: UploadRequestPayload;

  try {
    payload = (await request.json()) as UploadRequestPayload;
  } catch {
    return NextResponse.json(
      { error: "Formato richiesta non valido." },
      { status: 400 },
    );
  }

  const rawFileName =
    typeof payload.file_name === "string"
      ? payload.file_name.trim()
      : "";

  const mimeType =
    typeof payload.mime_type === "string"
      ? payload.mime_type.trim().toLowerCase()
      : "";

  const fileSize =
    typeof payload.file_size === "number"
      ? payload.file_size
      : Number(payload.file_size);

  if (!rawFileName) {
    return NextResponse.json(
      { error: "Nome file non valido." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(fileSize) ||
    !Number.isInteger(fileSize) ||
    fileSize <= 0
  ) {
    return NextResponse.json(
      { error: "Dimensione file non valida." },
      { status: 400 },
    );
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Ogni allegato può pesare al massimo 50 MB." },
      { status: 400 },
    );
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error:
          "Formato non supportato. Puoi allegare immagini JPG, PNG, WebP oppure video MP4 e MOV.",
      },
      { status: 400 },
    );
  }

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
      return NextResponse.json(
        {
          error:
            "Hai già inviato la tua risposta. Attendi una nuova risposta dall'assistenza.",
        },
        { status: 409 },
      );
    }

    const safeName = sanitizeFileName(rawFileName || "allegato");

    const path = [
      "support",
      ticket.id,
      "guest-upload",
      `${Date.now()}-${randomUUID()}-${safeName}`,
    ].join("/");

    const { data: signedUpload, error: signedUploadError } =
      await service.storage
        .from(SUPPORT_BUCKET)
        .createSignedUploadUrl(path, {
          upsert: false,
        });

    if (
      signedUploadError ||
      !signedUpload?.token ||
      !signedUpload.path
    ) {
      throw signedUploadError ?? new Error("Signed upload token missing");
    }

    return NextResponse.json({
      bucket: SUPPORT_BUCKET,
      path: signedUpload.path,
      signed_url: signedUpload.signedUrl,
      upload_token: signedUpload.token,
      file_name: safeName,
      file_size: fileSize,
      mime_type: mimeType,
    });
  } catch (error) {
    logApiError("PUBLIC_GUEST_SUPPORT SIGNED UPLOAD ERROR", {
      query: "create guest support signed upload url",
      ticket_id: ticketId,
      error,
    });

    return NextResponse.json(
      { error: "Non è stato possibile preparare il caricamento." },
      { status: 500 },
    );
  }
}
