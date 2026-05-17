import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type SignInPayload = {
  email: string;
  password: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  let payload: SignInPayload;
  try {
    payload = (await request.json()) as SignInPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.email) || !isNonEmptyString(payload.password)) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email.trim(),
    password: payload.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Ensure banned users cannot remain logged-in.
  const auth = await requireAuth({ allowMustChangePassword: true });
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    user: { id: data.user?.id ?? auth.ctx.user.id, email: auth.ctx.user.email },
    profile: auth.ctx.profile,
  });
}
