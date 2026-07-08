import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true });
}
