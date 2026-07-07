import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  sniffImageMime,
  sniffIsoBmffVideoMime,
} from "@/lib/api/file-signatures";
import { clampInt, isNonEmptyString, sanitizeFileName } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

type CreateReviewPayload = {
  request_id: string;
  rating: number;
  title?: string;
  body: string;
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
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const professionalId = searchParams.get("professional_id");
  const mine = searchParams.get("mine") === "true";

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 10, 1, 50);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let builder = supabase
    .from("reviews")
    .select(
      "id, request_id, professional_id, customer_id, rating, title, body, professional_reply, professional_replied_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (professionalId) {
    builder = builder.eq("professional_id", professionalId);
  }

  if (mine) {
    builder = builder.eq("customer_id", user.id);
  }

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }

  const rows = data ?? [];
  const customerIds = Array.from(new Set(rows.map((review) => review.customer_id)));
  const reviewIds = rows.map((review) => review.id);
  const service = createServiceClient();
  const [{ data: authors }, { data: attachments }] = await Promise.all([
    customerIds.length > 0
      ? service
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", customerIds)
      : Promise.resolve({ data: [] }),
    reviewIds.length > 0
      ? service
          .from("review_attachments")
          .select("id, review_id, file_url, file_type, mime_type, file_name, file_size, created_at")
          .in("review_id", reviewIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
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
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const contentType = request.headers.get("content-type") ?? "";
  let payload: CreateReviewPayload;
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    payload = {
      request_id: String(formData.get("request_id") ?? ""),
      rating: Number(formData.get("rating") ?? Number.NaN),
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
    };
    files = formData.getAll("files").filter((item): item is File => item instanceof File);
  } else {
    try {
      payload = (await request.json()) as CreateReviewPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (!isNonEmptyString(payload.request_id)) {
    return NextResponse.json({ error: "request_id is required" }, { status: 400 });
  }

  const rating = typeof payload.rating === "number" ? payload.rating : Number.NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1..5" }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!isNonEmptyString(body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  if (files.length > MAX_REVIEW_FILES) {
    return NextResponse.json({ error: `Max ${MAX_REVIEW_FILES} files` }, { status: 400 });
  }

  const detectedFiles: {
    file: File;
    contentType: string;
    mediaType: "image" | "video";
  }[] = [];

  for (const file of files) {
    if (file.size > MAX_REVIEW_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Max file size is 50MB" }, { status: 400 });
    }

    const detected = await detectReviewMedia(file);
    if (!detected) {
      return NextResponse.json(
        { error: "Unsupported file type (allowed: JPG/PNG/WebP/MP4/MOV)" },
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
    return NextResponse.json({ error: "Failed to validate request" }, { status: 500 });
  }

  if (!requestRow || requestRow.customer_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (requestRow.status !== "accepted") {
    return NextResponse.json(
      { error: "Request must be accepted to leave a review" },
      { status: 400 },
    );
  }

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("request_id", requestRow.id)
    .maybeSingle();

  if (existingReview) {
    return NextResponse.json(
      { error: "You already reviewed this request" },
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
    return NextResponse.json({ error: error.message }, { status: 400 });
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
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
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
      return NextResponse.json({ error: attachmentError.message }, { status: 400 });
    }

    uploadedAttachments.push(reviewAttachmentResponse(inserted as ReviewAttachmentRow));
  }

  return NextResponse.json({ review: { ...data, attachments: uploadedAttachments } });
}
