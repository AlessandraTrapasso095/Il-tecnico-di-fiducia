import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import { clampInt, isNonEmptyString, sanitizeFileName } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { notifyReviewReceived } from "@/lib/server/review-notifications";
import { createServiceClient } from "@/lib/supabase/service";

type CreateReviewPayload = {
  request_id: string;
  rating: number;
  title?: string;
  body?: string;
};

type ReviewAttachmentRow = {
  id: string;
  review_id: string;
  file_url: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

type ReviewListRow = {
  id: string;
  request_id: string;
  professional_id: string;
  customer_id: string;
  rating: number;
  title: string | null;
  body: string;
  professional_reply: string | null;
  professional_replied_at: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_REVIEW_FILES = 6;
const MAX_REVIEW_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

function reviewAttachmentResponse(row: ReviewAttachmentRow) {
  return {
    id: row.id,
    review_id: row.review_id,
    public_url: row.file_url,
    media_type: row.file_type,
    mime_type: row.mime_type,
    file_name: row.file_name,
    file_size: row.file_size,
    created_at: row.created_at,
  };
}

function isMissingReviewColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const haystack = `${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();
  return (
    ["42703", "PGRST204", "PGRST205"].includes(record.code ?? "") &&
    haystack.includes(column.toLowerCase())
  );
}

function isDuplicateReviewError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "23505",
  );
}

async function detectReviewMedia(file: File) {
  let contentType: string | null = await sniffImageMime(file);
  if (contentType && ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { contentType, mediaType: "image" as const };
  }

  contentType = await sniffIsoBmffVideoMime(file);
  if (contentType && ALLOWED_VIDEO_TYPES.has(contentType)) {
    return { contentType, mediaType: "video" as const };
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { supabase, user, profile } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const professionalId = searchParams.get("professional_id");
  const mine = searchParams.get("mine") === "true";

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 10, 1, 50);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const selectWithTitle =
    "id, request_id, professional_id, customer_id, rating, title, body, professional_reply, professional_replied_at, created_at, updated_at";
  const selectWithoutTitle =
    "id, request_id, professional_id, customer_id, rating, body, professional_reply, professional_replied_at, created_at, updated_at";

  function buildReviewsQuery(select: string) {
    let builder = supabase
      .from("reviews")
      .select(select, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (professionalId) {
      builder = builder.eq("professional_id", professionalId);
    }

    if (mine) {
      builder = builder.eq("customer_id", user.id);
    }

    return builder;
  }

  let { data, error, count } = await buildReviewsQuery(selectWithTitle);
  let hasReviewTitleColumn = true;

  if (isMissingReviewColumn(error, "title")) {
    logApiError("REVIEWS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "reviews select list with title",
      professional_id: professionalId,
      mine,
      error,
    });
    const fallback = await buildReviewsQuery(selectWithoutTitle);
    data = fallback.data;
    error = fallback.error;
    count = fallback.count;
    hasReviewTitleColumn = false;
  }

  if (error) {
    logApiError("REVIEWS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "reviews select list",
      professional_id: professionalId,
      mine,
      error,
    });
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((review) => ({
    ...review,
    title:
      hasReviewTitleColumn && "title" in review
        ? (review.title as string | null)
        : "",
  })) as ReviewListRow[];
  const customerIds = Array.from(new Set(rows.map((review) => review.customer_id)));
  const reviewIds = rows.map((review) => review.id);
  const service = createServiceClient();
  const [
    { data: authors, error: authorsError },
    { data: attachments, error: attachmentsError },
  ] = await Promise.all([
    customerIds.length > 0
      ? service
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length > 0
      ? service
          .from("review_attachments")
          .select("id, review_id, file_url, file_type, mime_type, file_name, file_size, created_at")
          .in("review_id", reviewIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (authorsError) {
    logApiError("REVIEWS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "profiles select authors for reviews",
      error: authorsError,
    });
  }

  if (attachmentsError) {
    logApiError("REVIEWS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "review_attachments select by review ids",
      error: attachmentsError,
    });
  }
  const authorsById = new Map((authors ?? []).map((author) => [author.id, author]));
  const attachmentsByReviewId = new Map<string, ReturnType<typeof reviewAttachmentResponse>[]>();

  for (const attachment of (attachments ?? []) as ReviewAttachmentRow[]) {
    const current = attachmentsByReviewId.get(attachment.review_id) ?? [];
    current.push(reviewAttachmentResponse(attachment));
    attachmentsByReviewId.set(attachment.review_id, current);
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    reviews: rows.map((review) => ({
      ...review,
      author: authorsById.get(review.customer_id) ?? null,
      attachments: attachmentsByReviewId.get(review.id) ?? [],
    })),
  });
  } catch (error) {
    logApiError("REVIEWS ERROR", {
      query: "GET /api/reviews",
      search: request.nextUrl.search,
      error,
    });
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const contentType = request.headers.get("content-type") ?? "";
  let payload: CreateReviewPayload;
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      payload = {
        request_id: String(formData.get("request_id") ?? ""),
        rating: Number(formData.get("rating") ?? Number.NaN),
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
      };
      files = formData.getAll("files").filter((item): item is File => item instanceof File);
    } catch (error) {
      logApiError("REVIEWS ERROR", {
        stage: "parse_multipart_payload",
        user_id: user.id,
        role: profile.role,
        error,
      });
      return NextResponse.json({ error: "Payload recensione non valido." }, { status: 400 });
    }
  } else {
    try {
      payload = (await request.json()) as CreateReviewPayload;
    } catch (error) {
      logApiError("REVIEWS ERROR", {
        stage: "parse_json_payload",
        user_id: user.id,
        role: profile.role,
        error,
      });
      return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
    }
  }

  if (!isNonEmptyString(payload.request_id)) {
    return NextResponse.json({ error: "Richiesta mancante." }, { status: 400 });
  }

  const rating = typeof payload.rating === "number" ? payload.rating : Number.NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "La valutazione deve essere tra 1 e 5 stelle." }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (files.length > MAX_REVIEW_FILES) {
    return NextResponse.json({ error: `Puoi allegare al massimo ${MAX_REVIEW_FILES} file.` }, { status: 400 });
  }

  const detectedFiles: {
    file: File;
    contentType: string;
    mediaType: "image" | "video";
  }[] = [];

  for (const file of files) {
    if (file.size > MAX_REVIEW_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Ogni file può pesare al massimo 50MB." }, { status: 400 });
    }

    const detected = await detectReviewMedia(file);
    if (!detected) {
      return NextResponse.json(
        { error: "Formato non supportato. Usa JPG, PNG, WebP, MP4 o MOV." },
        { status: 400 },
      );
    }

    detectedFiles.push({ file, ...detected });
  }

  // Derive relationships from the request row to avoid client tampering.
  const { data: requestRow, error: requestError } = await supabase
    .from("contact_requests")
    .select("id, status, professional_id, customer_id")
    .eq("id", payload.request_id)
    .maybeSingle();

  if (requestError) {
    logApiError("REVIEWS ERROR", {
      stage: "validate_contact_request",
      query: "contact_requests select id,status,professional_id,customer_id",
      user_id: user.id,
      role: profile.role,
      request_id: payload.request_id,
      rating: Math.round(rating),
      title_present: Boolean(title),
      body_present: Boolean(body),
      files_count: files.length,
      error: requestError,
    });
    return NextResponse.json({ error: "Errore durante la verifica della richiesta." }, { status: 500 });
  }

  if (!requestRow || requestRow.customer_id !== user.id) {
    return NextResponse.json({ error: "Richiesta non trovata." }, { status: 404 });
  }

  if (requestRow.status !== "accepted") {
    return NextResponse.json(
      { error: "Puoi recensire solo dopo l’accettazione della richiesta." },
      { status: 400 },
    );
  }

  const { data: existingReview, error: existingReviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("request_id", requestRow.id)
    .maybeSingle();

  if (existingReviewError) {
    logApiError("REVIEWS ERROR", {
      stage: "check_existing_review",
      query: "reviews select id by request_id",
      user_id: user.id,
      role: profile.role,
      request_id: requestRow.id,
      professional_id: requestRow.professional_id,
      error: existingReviewError,
    });
    return NextResponse.json({ error: "Errore durante la verifica della recensione." }, { status: 500 });
  }

  if (existingReview) {
    return NextResponse.json(
      { error: "Hai già lasciato una recensione per questa richiesta." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      request_id: requestRow.id,
      professional_id: requestRow.professional_id,
      customer_id: requestRow.customer_id,
      rating: Math.round(rating),
      title,
      body,
    })
    .select("id, request_id, professional_id, customer_id, rating, title, body, professional_reply, professional_replied_at, created_at, updated_at")
    .single();

  if (error) {
    logApiError("REVIEWS ERROR", {
      stage: "insert_review",
      query: "reviews insert",
      user_id: user.id,
      role: profile.role,
      request_id: requestRow.id,
      professional_id: requestRow.professional_id,
      customer_id: requestRow.customer_id,
      rating: Math.round(rating),
      title_present: Boolean(title),
      body_present: Boolean(body),
      files_count: files.length,
      error,
    });

    if (isDuplicateReviewError(error)) {
      return NextResponse.json(
        { error: "Hai già lasciato una recensione per questa richiesta." },
        { status: 409 },
      );
    }

    if (isMissingReviewColumn(error, "title")) {
      return NextResponse.json(
        {
          error:
            "Schema recensioni non aggiornato: manca la colonna title. Applica la migration e ricarica lo schema Supabase.",
        },
        { status: 500 },
      );
    }

    if (error.code === "42501") {
      return NextResponse.json(
        { error: "Non sei autorizzata a lasciare questa recensione." },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "Errore durante il salvataggio della recensione." }, { status: 500 });
  }

  try {
    await notifyReviewReceived({
      service: createServiceClient(),
      review: data,
    });
  } catch (notificationError) {
    console.error("[reviews] Failed to start review notification side effects", {
      review_id: data.id,
      error: notificationError,
      message: notificationError instanceof Error ? notificationError.message : null,
      stack: notificationError instanceof Error ? notificationError.stack : null,
    });
  }

  const uploadedAttachments: ReturnType<typeof reviewAttachmentResponse>[] = [];

  for (const item of detectedFiles) {
    const safeName = sanitizeFileName(item.file.name || "review-media");
    const path = `${user.id}/reviews/${data.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("public-media")
      .upload(path, item.file, {
        upsert: false,
        contentType: item.contentType,
        cacheControl: "3600",
      });

    if (uploadError) {
      logApiError("REVIEWS ERROR", {
        stage: "upload_review_attachment",
        query: "storage public-media upload",
        user_id: user.id,
        role: profile.role,
        review_id: data.id,
        request_id: data.request_id,
        file_name: safeName,
        file_size: item.file.size,
        mime_type: item.contentType,
        error: uploadError,
      });
      return NextResponse.json({ error: "Upload allegato recensione non riuscito." }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from("public-media").getPublicUrl(path);
    const { data: inserted, error: attachmentError } = await supabase
      .from("review_attachments")
      .insert({
        review_id: data.id,
        customer_id: user.id,
        bucket_id: "public-media",
        file_url: publicUrl.publicUrl,
        file_path: path,
        file_type: item.mediaType,
        mime_type: item.contentType,
        file_name: safeName,
        file_size: item.file.size,
      })
      .select("id, review_id, file_url, file_type, mime_type, file_name, file_size, created_at")
      .single();

    if (attachmentError) {
      await supabase.storage.from("public-media").remove([path]);
      logApiError("REVIEWS ERROR", {
        stage: "insert_review_attachment",
        query: "review_attachments insert",
        user_id: user.id,
        role: profile.role,
        review_id: data.id,
        request_id: data.request_id,
        file_name: safeName,
        file_size: item.file.size,
        mime_type: item.contentType,
        error: attachmentError,
      });
      return NextResponse.json(
        { error: "Salvataggio allegato recensione non riuscito." },
        { status: 500 },
      );
    }

    uploadedAttachments.push(reviewAttachmentResponse(inserted as ReviewAttachmentRow));
  }

  return NextResponse.json({ review: { ...data, attachments: uploadedAttachments } });
}
