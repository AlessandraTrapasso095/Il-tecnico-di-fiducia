import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ followedId: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { followedId } = await params;
  if (!followedId) {
    return NextResponse.json({ error: "Missing followedId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("professional_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", followedId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
