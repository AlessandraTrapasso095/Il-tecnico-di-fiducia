import { NextResponse } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type ConfirmEmailOtpPayload = {
  email: string;
  token: string;
};

function normalizeOtpToken(raw: string) {
  return raw.replace(/\s+/g, "").trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:confirm_otp:ip:${ip}`,
    maxHits: 20,
    windowSeconds: 600,
    errorMessage: "Too many verification attempts. Please try again later.",
  });
  if (ipLimited) return ipLimited;

  let payload: ConfirmEmailOtpPayload;
  try {
    payload = (await request.json()) as ConfirmEmailOtpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.email) || !isNonEmptyString(payload.token)) {
    return NextResponse.json(
      { error: "Email and token are required" },
      { status: 400 },
    );
  }

  const email = payload.email.trim();
  const emailHash = await hashRateLimitId(`email:${email.toLowerCase()}`);
  const emailLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:confirm_otp:email:${emailHash}`,
    maxHits: 10,
    windowSeconds: 600,
    errorMessage: "Too many verification attempts for this email. Please try again later.",
  });
  if (emailLimited) return emailLimited;

  const token = normalizeOtpToken(payload.token);

  if (!/^\d{6,10}$/.test(token)) {
    return NextResponse.json(
      { error: "Token must be a numeric code (6–10 digits)" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const user = data.user;
  if (!user) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { data: isActive, error: activeError } = await supabase.rpc(
    "is_active_user",
  );

  if (activeError) {
    return NextResponse.json(
      { error: "Verified, but failed to validate session" },
      { status: 500 },
    );
  }

  if (!isActive) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, email, first_name, last_name, province_code, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Verified, but failed to load profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, email_confirmed_at: user.email_confirmed_at },
    profile,
  });
}
