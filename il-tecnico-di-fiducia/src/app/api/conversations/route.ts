import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { logApiError } from "@/lib/server/api-logger";
import { listConversationsForViewer } from "@/lib/server/conversations";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, profile, user } = auth.ctx;

  const statusFilter = request.nextUrl.searchParams.get("status");

  try {
    const conversations = await listConversationsForViewer({
      supabase,
      userId: user.id,
      role: profile.role,
      statusFilter,
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    logApiError("CONVERSATIONS ERROR", {
      user_id: user.id,
      role: profile.role,
      query: "GET /api/conversations",
      status_filter: statusFilter,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare le conversazioni." },
      { status: 500 },
    );
  }
}
