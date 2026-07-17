import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const offlineAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    try {
      const service = createServiceClient();
      const { error: activityError } = await service
        .from("user_activity")
        .upsert(
          {
            user_id: user.id,
            last_seen_at: offlineAt,
          },
          { onConflict: "user_id" },
        );

      if (activityError) {
        console.error("[auth/sign-out] Failed to mark user offline", {
          user_id: user.id,
          code: activityError.code,
          message: activityError.message,
          details: activityError.details,
          hint: activityError.hint,
        });
      }
    } catch (activityError) {
      console.error("[auth/sign-out] Failed to mark user offline", {
        user_id: user.id,
        error: activityError,
        message: activityError instanceof Error ? activityError.message : null,
        stack: activityError instanceof Error ? activityError.stack : null,
      });
    }
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
