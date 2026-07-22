import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { resolveCommentAuthors } from "@/lib/server/post-comment-authors";
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
    logApiError("POST_COMMENTS ERROR", {
      query: "post_comments select by post_id",
      post_id: id,
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile caricare i commenti. Riprova." },
      { status: 500 },
    );
  }

  const authorsById = await resolveCommentAuthors(
    (data ?? []).map((comment) => comment.author_id),
  );

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
    logApiError("POST_COMMENTS ERROR", {
      query: "post_comments insert comment",
      post_id: id,
      user_id: user.id,
      error,
    });

    const status =
      error.code === "42501" ? 403 : error.code === "23503" ? 404 : 400;
    const message =
      status === 403
        ? "Non hai i permessi per commentare questo post."
        : status === 404
          ? "Post non trovato."
          : "Non è stato possibile pubblicare il commento. Riprova.";

    return NextResponse.json({ error: message }, { status });
  }

  try {
    const service = createServiceClient();
    const { data: post, error: postError } = await service
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .maybeSingle();

    if (postError) throw postError;

    await ensureSocialNotification({
      recipientId: post?.author_id,
      actorId: user.id,
      type: "post_commented",
      entityType: "post",
      entityId: id,
      dedupe: "recent",
    });
  } catch (notificationError) {
    logApiError("POST_COMMENTS NOTIFICATION ERROR", {
      query: "post comment notification",
      post_id: id,
      user_id: user.id,
      error: notificationError,
    });
  }

  const authorsById = await resolveCommentAuthors([profile.id]);
  return NextResponse.json({
    comment: {
      ...data,
      author: authorsById.get(profile.id) ?? {
        id: profile.id,
        user_id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        display_name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        avatar_url: null,
      },
    },
  });
}
