import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";

type UpdatePasswordPayload = {
  new_password: string;
};

export async function POST(request: Request) {
  const auth = await requireAuth({ allowMustChangePassword: true });
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  let payload: UpdatePasswordPayload;
  try {
    payload = (await request.json()) as UpdatePasswordPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.new_password)) {
    return NextResponse.json({ error: "new_password is required" }, { status: 400 });
  }

  if (payload.new_password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password: payload.new_password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (profile.role === "admin" && profile.must_change_password) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
