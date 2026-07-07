import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("[conversation-read] Failed to mark conversation as read", error);
    return NextResponse.json({ ok: true, read_receipts_available: false });
  }

  return NextResponse.json({ ok: true });
}
