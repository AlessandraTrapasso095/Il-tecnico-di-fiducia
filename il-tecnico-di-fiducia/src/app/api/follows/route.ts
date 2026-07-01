import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { ensureSocialNotification } from "@/lib/server/social-notifications";

type FollowPayload = {
  followed_id: string;
};

type FollowedProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  province_code: string | null;
};

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { data: follows, error: followError } = await supabase
    .from("professional_follows")
    .select("followed_id, created_at")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false });

  if (followError) {
    return NextResponse.json({ error: "Failed to load followed professionals" }, { status: 500 });
  }

  const followedIds = (follows ?? []).map((follow) => follow.followed_id);
  const { data: professionals, error: professionalError } =
    followedIds.length > 0
      ? await supabase
          .from("professional_directory")
          .select("id, first_name, last_name, avatar_url, headline, province_code")
          .in("id", followedIds)
      : { data: [], error: null };

  if (professionalError) {
    return NextResponse.json({ error: "Failed to load followed professionals" }, { status: 500 });
  }

  const professionalsById = new Map(
    ((professionals ?? []) as FollowedProfessionalRow[]).map((professional) => [
      professional.id,
      professional,
    ]),
  );

  return NextResponse.json({
    followed: followedIds
      .map((id) => professionalsById.get(id))
      .filter(Boolean) as FollowedProfessionalRow[],
  });
}

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

  await ensureSocialNotification({
    recipientId: payload.followed_id,
    actorId: user.id,
    type: "follow_started",
    entityType: "professional",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
