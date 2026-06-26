import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type CreateSupportMessagePayload = {
  body: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id: ticketId } = await params;
  if (!isNonEmptyString(ticketId)) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_id, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load support messages" },
      { status: 500 },
    );
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id: ticketId } = await params;
  if (!isNonEmptyString(ticketId)) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  let payload: CreateSupportMessagePayload;
  try {
    payload = (await request.json()) as CreateSupportMessagePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, author_id, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (profile.role !== "admin" && ticket.author_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (ticket.status !== "open") {
    return NextResponse.json(
      { error: "Cannot reply to a closed ticket" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      body: payload.body.trim(),
    })
    .select("id, ticket_id, sender_id, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (profile.role === "admin") {
    await writeAuditLog(supabase, {
      actorId: profile.id,
      action: "admin.reply_support_ticket",
      targetType: "support_ticket",
      targetId: ticketId,
    });
  }

  return NextResponse.json({ message: data });
}
