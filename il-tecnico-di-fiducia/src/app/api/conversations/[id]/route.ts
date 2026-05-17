import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "id, request_id, status, customer_id, professional_id, last_message_at, last_message_body, last_message_sender_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 },
    );
  }

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: requestRow } = await supabase
    .from("contact_requests")
    .select("id, subject, status, responded_at, created_at, updated_at")
    .eq("id", conversation.request_id)
    .maybeSingle();

  if (profile.role === "customer") {
    const { data: pro } = await supabase
      .from("professional_directory")
      .select("id, first_name, last_name, province_code, avatar_url, headline")
      .eq("id", conversation.professional_id)
      .maybeSingle();

    return NextResponse.json({
      conversation,
      request: requestRow ?? null,
      participant: pro ?? null,
    });
  }

  if (profile.role === "professional") {
    const { data: customer } = await supabase
      .from("customer_directory")
      .select("id, first_name, last_name, province_code")
      .eq("id", conversation.customer_id)
      .maybeSingle();

    return NextResponse.json({
      conversation,
      request: requestRow ?? null,
      participant: customer ?? null,
    });
  }

  return NextResponse.json({
    conversation,
    request: requestRow ?? null,
    participant: null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["customer", "professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("conversation_user_state").upsert(
    {
      conversation_id: id,
      user_id: user.id,
      hidden_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
