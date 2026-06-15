import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type ReplyPayload = {
  body: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: ReplyPayload;
  try {
    payload = (await request.json()) as ReplyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("id, professional_id, professional_reply")
    .eq("id", id)
    .maybeSingle();

  if (!review || review.professional_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (review.professional_reply) {
    return NextResponse.json(
      { error: "Review already has a reply" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({
      professional_reply: payload.body.trim(),
      professional_replied_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, professional_reply, professional_replied_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ review: data });
}
