import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";

type CreateReviewPayload = {
  request_id: string;
  rating: number;
  body: string;
};

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
      "id, request_id, professional_id, customer_id, rating, body, created_at, updated_at",
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

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    reviews: data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: CreateReviewPayload;
  try {
    payload = (await request.json()) as CreateReviewPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.request_id)) {
    return NextResponse.json({ error: "request_id is required" }, { status: 400 });
  }

  const rating = typeof payload.rating === "number" ? payload.rating : Number.NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1..5" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
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

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      request_id: requestRow.id,
      professional_id: requestRow.professional_id,
      customer_id: requestRow.customer_id,
      rating: Math.round(rating),
      body: payload.body.trim(),
    })
    .select("id, request_id, professional_id, customer_id, rating, body, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ review: data });
}
