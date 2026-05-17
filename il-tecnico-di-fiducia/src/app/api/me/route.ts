import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function GET() {
  const auth = await requireAuth({ allowMustChangePassword: true });
  if (!auth.ok) return auth.response;

  const { user, profile } = auth.ctx;
  return NextResponse.json({ user, profile });
}
