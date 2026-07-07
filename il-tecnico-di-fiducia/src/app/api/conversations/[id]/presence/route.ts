import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

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

  const { error } = await supabase.from("conversation_active_presence").upsert(
    {
      conversation_id: id,
      user_id: user.id,
      active_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (error) {
    console.error("[conversation-presence] Failed to touch active conversation", error);
    return NextResponse.json({ ok: true, presence_available: false });
  }

  return NextResponse.json({ ok: true });
}
