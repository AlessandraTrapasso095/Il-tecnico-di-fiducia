import { NextResponse } from "next/server";

import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type ResendSignupOtpPayload = {
  email: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  let payload: ResendSignupOtpPayload;
  try {
    payload = (await request.json()) as ResendSignupOtpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.email)) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const email = payload.email.trim();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
