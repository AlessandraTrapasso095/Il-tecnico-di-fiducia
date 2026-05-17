import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

type UpdatePayload = {
  status: "accepted" | "rejected";
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: reqRow, error } = await supabase
    .from("contact_requests")
    .select(
      "id, customer_id, professional_id, subject, message, privacy_accepted, status, responded_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load request" },
      { status: 500 },
    );
  }

  if (!reqRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("request_id", id)
    .maybeSingle();

  return NextResponse.json({
    request: reqRow,
    conversation_id: conversation?.id ?? null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.status !== "accepted" && payload.status !== "rejected") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contact_requests")
    .update({ status: payload.status })
    .eq("id", id)
    .select("id, status, responded_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ request: data });
}
