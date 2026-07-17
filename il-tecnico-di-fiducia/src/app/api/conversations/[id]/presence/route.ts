import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { logApiError } from "@/lib/server/api-logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
      logApiError("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "verify_conversation",
        conversation_id: id,
        user_id: user.id,
        query: "conversations select id by id",
        error: conversationError,
      });
      console.error("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "verify_conversation",
        conversation_id: id,
        user_id: user.id,
        error: conversationError,
        message: conversationError.message,
        stack: null,
      });
      return NextResponse.json({ ok: true, presence_available: false });
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
      logApiError("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "upsert_conversation_active_presence",
        conversation_id: id,
        user_id: user.id,
        query: "conversation_active_presence upsert conversation_id,user_id,active_at",
        error,
      });
      console.error("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "upsert_conversation_active_presence",
        conversation_id: id,
        user_id: user.id,
        error,
        message: error.message,
        stack: null,
      });
      return NextResponse.json({ ok: true, presence_available: false });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("PRESENCE ERROR", {
      route: "/api/conversations/[id]/presence",
      query: "POST /api/conversations/[id]/presence",
      error,
    });
    console.error("PRESENCE ERROR", {
      error,
      message: error instanceof Error ? error.message : null,
      stack: error instanceof Error ? error.stack : null,
    });

    return NextResponse.json({ ok: true, presence_available: false });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
      logApiError("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "verify_conversation_delete",
        conversation_id: id,
        user_id: user.id,
        query: "conversations select id by id",
        error: conversationError,
      });
      console.error("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "verify_conversation_delete",
        conversation_id: id,
        user_id: user.id,
        error: conversationError,
        message: conversationError.message,
        stack: null,
      });
      return NextResponse.json({ ok: true, presence_available: false });
    }

    if (!conversation) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("conversation_active_presence")
      .delete()
      .eq("conversation_id", id)
      .eq("user_id", user.id);

    if (error) {
      logApiError("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "delete_conversation_active_presence",
        conversation_id: id,
        user_id: user.id,
        query: "conversation_active_presence delete conversation_id,user_id",
        error,
      });
      console.error("PRESENCE ERROR", {
        route: "/api/conversations/[id]/presence",
        stage: "delete_conversation_active_presence",
        conversation_id: id,
        user_id: user.id,
        error,
        message: error.message,
        stack: null,
      });
      return NextResponse.json({ ok: true, presence_available: false });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("PRESENCE ERROR", {
      route: "/api/conversations/[id]/presence",
      query: "DELETE /api/conversations/[id]/presence",
      error,
    });
    console.error("PRESENCE ERROR", {
      error,
      message: error instanceof Error ? error.message : null,
      stack: error instanceof Error ? error.stack : null,
    });

    return NextResponse.json({ ok: true, presence_available: false });
  }
}
