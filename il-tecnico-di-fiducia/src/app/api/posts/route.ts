import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";

type CreatePostPayload = {
  body: string;
};

type PostAttachmentRow = {
  id: string;
  post_id: string;
  public_url: string;
  media_type: "image" | "video";
  mime_type: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

type PostAttachmentDbRow = {
  id: string;
  post_id: string;
  file_url: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile: viewer } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const feed = searchParams.get("feed");
  const authorId = searchParams.get("author_id");

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 10, 1, 50);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let authorIds: string[] | null = null;

  if (feed === "following") {
    if (viewer.role !== "professional") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: follows, error: followError } = await supabase
      .from("professional_follows")
      .select("followed_id")
      .eq("follower_id", user.id);

    if (followError) {
      return NextResponse.json({ error: "Failed to load follows" }, { status: 500 });
    }

    const followed = (follows ?? []).map((f) => f.followed_id);
    authorIds = Array.from(new Set([user.id, ...followed]));
  } else if (authorId) {
    // Profile view: customers can view if the pro is visible to them (RLS on professional_directory).
    if (viewer.role === "professional" && authorId !== user.id) {
      const { data: followRow } = await supabase
        .from("professional_follows")
        .select("followed_id")
        .eq("follower_id", user.id)
        .eq("followed_id", authorId)
        .maybeSingle();

      if (!followRow) {
        return NextResponse.json({ page, page_size: pageSize, posts: [] });
      }
    }

    if (viewer.role === "customer") {
      const { data: proVisible } = await supabase
        .from("professional_directory")
        .select("id")
        .eq("id", authorId)
        .maybeSingle();

      if (!proVisible) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    authorIds = [authorId];
  }

  let builder = supabase
    .from("posts")
    .select("id, author_id, body, created_at, updated_at")
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (authorIds) {
    builder = builder.in("author_id", authorIds);
  }

  const { data: posts, error } = await builder;

  if (error) {
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }

  const authorIdSet = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const postIds = (posts ?? []).map((p) => p.id);

  const { data: authors } =
    authorIdSet.length > 0
      ? await supabase
          .from("professional_directory")
          .select("id, first_name, last_name, avatar_url, headline, province_code")
          .in("id", authorIdSet)
      : { data: [] };

  const [{ data: likes }, { data: comments }] =
    postIds.length > 0
      ? await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
          supabase.from("post_comments").select("post_id").in("post_id", postIds),
        ])
      : [{ data: [] }, { data: [] }];

  const { data: attachments } =
    postIds.length > 0
      ? await supabase
          .from("post_attachments")
          .select("id, post_id, file_url, file_type, mime_type, file_name, file_size, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const authorsById = new Map((authors ?? []).map((a) => [a.id, a]));
  const likesCountByPostId = new Map<string, number>();
  const commentsCountByPostId = new Map<string, number>();
  const attachmentsByPostId = new Map<string, PostAttachmentRow[]>();
  const likedByMe = new Set<string>();

  for (const like of likes ?? []) {
    likesCountByPostId.set(
      like.post_id,
      (likesCountByPostId.get(like.post_id) ?? 0) + 1,
    );
    if (like.user_id === user.id) likedByMe.add(like.post_id);
  }

  for (const comment of comments ?? []) {
    commentsCountByPostId.set(
      comment.post_id,
      (commentsCountByPostId.get(comment.post_id) ?? 0) + 1,
    );
  }

  for (const attachment of (attachments ?? []) as PostAttachmentDbRow[]) {
    const existing = attachmentsByPostId.get(attachment.post_id) ?? [];
    attachmentsByPostId.set(attachment.post_id, [
      ...existing,
      {
        id: attachment.id,
        post_id: attachment.post_id,
        public_url: attachment.file_url,
        media_type: attachment.file_type,
        mime_type: attachment.mime_type ?? "",
        file_name: attachment.file_name,
        file_size: attachment.file_size,
        created_at: attachment.created_at,
      },
    ]);
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    posts: (posts ?? []).map((p) => ({
      ...p,
      author: authorsById.get(p.author_id) ?? null,
      likes_count: likesCountByPostId.get(p.id) ?? 0,
      comments_count: commentsCountByPostId.get(p.id) ?? 0,
      liked_by_me: likedByMe.has(p.id),
      attachments: attachmentsByPostId.get(p.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: CreatePostPayload;
  try {
    payload = (await request.json()) as CreatePostPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.body)) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, body: payload.body.trim() })
    .select("id, author_id, body, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ post: data });
}
