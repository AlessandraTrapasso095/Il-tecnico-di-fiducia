import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { logApiError } from "@/lib/server/api-logger";

export async function POST() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

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
