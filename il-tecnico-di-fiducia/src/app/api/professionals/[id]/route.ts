import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: professional, error: professionalError } = await supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, bio, specializations, avatar_url, cover_url, available_remote, available_travel, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (professionalError) {
    return NextResponse.json(
      { error: "Failed to load professional" },
      { status: 500 },
    );
  }

  if (!professional) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("professional_categories")
    .select("category_id")
    .eq("professional_id", id);

  if (mappingsError) {
    return NextResponse.json(
      { error: "Failed to load professional categories" },
      { status: 500 },
    );
  }

  const categoryIds = (mappings ?? []).map((m) => m.category_id);
  const { data: categories, error: categoriesError } = categoryIds.length
    ? await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .in("id", categoryIds)
    : { data: [], error: null };

  if (categoriesError) {
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 },
    );
  }

  let contactRequest: { id: string; status: string; created_at: string } | null = null;
  let isFollowing: boolean | null = null;
  let isSaved: boolean | null = null;

  if (profile.role === "customer") {
    const { data: lastRequest } = await supabase
      .from("contact_requests")
      .select("id, status, created_at")
      .eq("customer_id", user.id)
      .eq("professional_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    contactRequest = lastRequest ?? null;

    const { data: saved } = await supabase
      .from("saved_professionals")
      .select("professional_id")
      .eq("customer_id", user.id)
      .eq("professional_id", id)
      .maybeSingle();
    isSaved = !!saved;
  }

  if (profile.role === "professional") {
    const { data: followRow } = await supabase
      .from("professional_follows")
      .select("followed_id")
      .eq("follower_id", user.id)
      .eq("followed_id", id)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  return NextResponse.json({
    professional,
    categories: categories ?? [],
    viewer: {
      role: profile.role,
      contact_request: contactRequest,
      is_following: isFollowing,
      is_saved: isSaved,
    },
  });
}
