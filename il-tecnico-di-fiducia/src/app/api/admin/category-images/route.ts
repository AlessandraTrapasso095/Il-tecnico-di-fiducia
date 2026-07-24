import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { sniffImageMime } from "@/lib/api/file-signatures";
import { sanitizeFileName } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const CATEGORY_IMAGE_BUCKET = "category-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "img";
}

function extractCategoryImagePath(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${CATEGORY_IMAGE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  const imagePath = url.slice(markerIndex + marker.length);
  return imagePath ? decodeURIComponent(imagePath) : null;
}

async function ensureCategoryImageBucket() {
  const service = createServiceClient();
  const { data: bucket, error: bucketError } = await service.storage.getBucket(CATEGORY_IMAGE_BUCKET);

  if (bucketError && bucketError.message !== "Bucket not found") {
    throw bucketError;
  }

  if (!bucket) {
    const { error } = await service.storage.createBucket(CATEGORY_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_SIZE,
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
    });
    if (error) throw error;
    return service;
  }

  if (!bucket.public) {
    const { error } = await service.storage.updateBucket(CATEGORY_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_SIZE,
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
    });
    if (error) throw error;
  }

  return service;
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData non valido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleziona un’immagine da caricare." }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "L’immagine non può superare 5 MB." },
      { status: 400 },
    );
  }

  const mime = await sniffImageMime(file);
  if (!mime || !ALLOWED_IMAGE_TYPES.has(mime)) {
    return NextResponse.json(
      { error: "Sono consentite solo immagini JPG, PNG o WebP." },
      { status: 400 },
    );
  }

  try {
    const service = await ensureCategoryImageBucket();
    const safeName = sanitizeFileName(file.name || "categoria");
    const extension = extensionFromMime(mime);
    const imagePath = `categories/${Date.now()}-${crypto.randomUUID()}-${safeName}.${extension}`;
    const { error: uploadError } = await service.storage
      .from(CATEGORY_IMAGE_BUCKET)
      .upload(imagePath, file, {
        cacheControl: "31536000",
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      logApiError("ADMIN CATEGORY IMAGE ERROR", {
        query: "category image upload",
        error: uploadError,
      });
      return NextResponse.json(
        { error: "Non è stato possibile caricare l’immagine." },
        { status: 400 },
      );
    }

    const { data } = service.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(imagePath);
    return NextResponse.json({ image_url: data.publicUrl, path: imagePath });
  } catch (error) {
    logApiError("ADMIN CATEGORY IMAGE ERROR", {
      query: "POST /api/admin/category-images",
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile preparare il bucket immagini categorie." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const imageUrl =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { image_url?: unknown }).image_url
      : null;
  const imagePath = extractCategoryImagePath(typeof imageUrl === "string" ? imageUrl : null);

  if (!imagePath) return NextResponse.json({ ok: true, skipped: true });

  try {
    const service = createServiceClient();
    const { error } = await service.storage.from(CATEGORY_IMAGE_BUCKET).remove([imagePath]);
    if (error) {
      logApiError("ADMIN CATEGORY IMAGE ERROR", {
        query: "category image remove",
        error,
      });
      return NextResponse.json(
        { error: "Non è stato possibile rimuovere la vecchia immagine." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("ADMIN CATEGORY IMAGE ERROR", {
      query: "DELETE /api/admin/category-images",
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile rimuovere la vecchia immagine." },
      { status: 500 },
    );
  }
}
