import { NextResponse } from "next/server";

import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type SignUpPayload = {
  role: "customer" | "professional";
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  province_code?: string | null;
  phone?: string | null;
  accept_terms: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  let payload: SignUpPayload;
  try {
    payload = (await request.json()) as SignUpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.accept_terms) {
    return NextResponse.json(
      { error: "Terms must be accepted" },
      { status: 400 },
    );
  }

  if (payload.role !== "customer" && payload.role !== "professional") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.email) || !isNonEmptyString(payload.password)) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  if (
    !isNonEmptyString(payload.first_name) ||
    !isNonEmptyString(payload.last_name)
  ) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      data: {
        role: payload.role,
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        province_code: payload.province_code ?? null,
        phone: payload.phone ?? null,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Enforce "Confirm email" flow: session must be null until OTP confirmation.
  if (data.session) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "Email confirmation must be enabled in Supabase (Auth Providers -> Email -> Confirm email).",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: payload.email.trim(),
    requires_email_otp: true,
  });
}
