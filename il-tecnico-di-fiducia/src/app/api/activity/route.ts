import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { logApiError } from "@/lib/server/api-logger";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActivityPayload = {
  active_conversation_id?: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { supabase, user } = auth.ctx;
    let payload: ActivityPayload | null = null;

    try {
      payload = (await request.json()) as ActivityPayload;
    } catch {
      payload = null;
    }

    const { error: activityError } = await supabase.rpc("touch_user_activity");
    if (activityError) {
      logApiError("ACTIVITY ERROR", {
        query: "rpc touch_user_activity",
        user_id: user.id,
        error: activityError,
      });
    }

    const activeConversationId = payload?.active_conversation_id?.trim() || null;
    if (activeConversationId && UUID_PATTERN.test(activeConversationId)) {
      const { error: activeConversationError } = await supabase
        .from("conversation_active_presence")
        .upsert(
          {
            conversation_id: activeConversationId,
            user_id: user.id,
            active_at: new Date().toISOString(),
          },
          { onConflict: "conversation_id,user_id" },
        );

      if (activeConversationError) {
        logApiError("ACTIVITY ERROR", {
          query: "conversation_active_presence upsert from /api/activity",
          conversation_id: activeConversationId,
          user_id: user.id,
          error: activeConversationError,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("ACTIVITY ERROR", {
      query: "POST /api/activity",
      error,
    });
    console.error("ACTIVITY ERROR", {
      error,
      message: error instanceof Error ? error.message : null,
      stack: error instanceof Error ? error.stack : null,
    });

    return NextResponse.json({ ok: true, activity_available: false });
  }
}
