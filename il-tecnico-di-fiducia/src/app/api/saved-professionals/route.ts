import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { attachProfessionalRatings } from "@/lib/server/professional-ratings";

type SavePayload = {
  professional_id: string;
};

type SavedProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { data: rows, error } = await supabase
    .from("saved_professionals")
    .select("professional_id, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load saved professionals" },
      { status: 500 },
    );
  }

  const ids = (rows ?? []).map((r) => r.professional_id);
  if (ids.length === 0) {
    return NextResponse.json({ professionals: [] });
  }

  const { data: professionals, error: professionalsError } = await supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, specializations, avatar_url, available_remote, available_travel",
    )
    .in("id", ids);

  if (professionalsError) {
    return NextResponse.json(
      { error: "Failed to load professionals" },
      { status: 500 },
    );
  }

  const byId = new Map(
    ((professionals ?? []) as SavedProfessionalRow[]).map((professional) => [
      professional.id,
      professional,
    ]),
  );
  const orderedProfessionals = ids
    .map((id) => byId.get(id))
    .filter((professional): professional is SavedProfessionalRow => Boolean(professional));

  return NextResponse.json({
    professionals: await attachProfessionalRatings(supabase, orderedProfessionals),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: SavePayload;
  try {
    payload = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.professional_id) {
    return NextResponse.json(
      { error: "professional_id is required" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("saved_professionals").upsert(
    {
      customer_id: user.id,
      professional_id: payload.professional_id,
    },
    // Bookmarks are idempotent: if the row already exists, ignore the duplicate
    // instead of requiring UPDATE permissions/RLS (least-privilege).
    { onConflict: "customer_id,professional_id", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
