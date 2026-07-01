import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";
import { ensureSocialNotification } from "@/lib/server/social-notifications";
import { createServiceClient } from "@/lib/supabase/service";

type CreateCommentPayload = {
  body: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const limit = clampInt(request.nextUrl.searchParams.get("limit"), 50, 1, 200);

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, created_at, updated_at")
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }

  const authorIds = Array.from(new Set((data ?? []).map((comment) => comment.author_id)));
  const service = createServiceClient();
  const { data: authors } =
    authorIds.length > 0
      ? await service
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", authorIds)
      : { data: [] };
  const authorsById = new Map((authors ?? []).map((author) => [author.id, author]));

  return NextResponse.json({
    comments: (data ?? []).map((comment) => ({
      ...comment,
      author: authorsById.get(comment.author_id) ?? null,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: CreateCommentPayload;
  try {
    payload = (await request.json()) as CreateCommentPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: id, author_id: user.id, body: payload.body.trim() })
    .select("id, post_id, author_id, body, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: post } = await service
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  await ensureSocialNotification({
    recipientId: post?.author_id,
    actorId: user.id,
    type: "post_commented",
    entityType: "post",
    entityId: id,
    dedupe: "recent",
  });

  return NextResponse.json({
    comment: {
      ...data,
      author: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    },
  });
}
