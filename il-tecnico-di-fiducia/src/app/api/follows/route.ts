import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

type FollowPayload = {
  followed_id: string;
};

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: FollowPayload;
  try {
    payload = (await request.json()) as FollowPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.followed_id) {
    return NextResponse.json({ error: "followed_id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("professional_follows").insert({
    follower_id: user.id,
    followed_id: payload.followed_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
