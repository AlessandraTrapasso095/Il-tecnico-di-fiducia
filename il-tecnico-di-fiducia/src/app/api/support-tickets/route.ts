import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";

type CreateTicketPayload = {
  subject: string;
  body: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 20, 1, 100);

  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let builder = supabase
    .from("support_tickets")
    .select("id, author_id, subject, body, status, created_at, updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (status) {
    builder = builder.eq("status", status);
  }

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load support tickets" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    tickets: data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: CreateTicketPayload;
  try {
    payload = (await request.json()) as CreateTicketPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.subject) || !isNonEmptyString(payload.body)) {
    return NextResponse.json(
      { error: "subject and body are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      author_id: user.id,
      subject: payload.subject.trim(),
      body: payload.body.trim(),
      status: "open",
    })
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ticket: data });
}
