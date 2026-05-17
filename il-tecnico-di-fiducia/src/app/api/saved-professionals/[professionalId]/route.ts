import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ professionalId: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["customer"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  const { professionalId } = await params;
  if (!professionalId) {
    return NextResponse.json({ error: "Missing professionalId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_professionals")
    .delete()
    .eq("customer_id", user.id)
    .eq("professional_id", professionalId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
