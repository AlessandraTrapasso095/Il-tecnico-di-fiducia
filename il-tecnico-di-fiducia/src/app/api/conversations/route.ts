import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
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
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 },
    );
  }
}
