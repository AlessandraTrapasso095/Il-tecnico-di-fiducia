import { NextResponse } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { mapSupabaseAuthError } from "@/lib/api/auth-errors";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type ResendSignupOtpPayload = {
  email: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:resend_otp:ip:${ip}`,
    maxHits: 10,
    windowSeconds: 600,
    errorMessage: "IP OTP resend rate limit exceeded. Please try again later.",
  });
  if (ipLimited) return ipLimited;

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
  const emailHash = await hashRateLimitId(`email:${email.toLowerCase()}`);
  const emailLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:resend_otp:email:${emailHash}`,
    maxHits: 3,
    windowSeconds: 600,
    errorMessage: "Email OTP resend rate limit exceeded. Please try again later.",
  });
  if (emailLimited) return emailLimited;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return NextResponse.json({ error: mapSupabaseAuthError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
