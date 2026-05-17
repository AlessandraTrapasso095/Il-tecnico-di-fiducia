import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt, isNonEmptyString } from "@/lib/api/validation";

type CreatePostPayload = {
  body: string;
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
  const { data: authors } =
    authorIdSet.length > 0
      ? await supabase
          .from("professional_directory")
          .select("id, first_name, last_name, avatar_url, headline, province_code")
          .in("id", authorIdSet)
      : { data: [] };

  const authorsById = new Map((authors ?? []).map((a) => [a.id, a]));

  return NextResponse.json({
    page,
    page_size: pageSize,
    posts: (posts ?? []).map((p) => ({
      ...p,
      author: authorsById.get(p.author_id) ?? null,
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
