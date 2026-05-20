import { NextResponse } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { getRequestBaseUrl } from "@/lib/api/base-url";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type RequestPasswordResetPayload = {
  email: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:reset:ip:${ip}`,
    maxHits: 10,
    windowSeconds: 600,
    errorMessage: "Too many requests. Please try again later.",
  });
  if (ipLimited) return ipLimited;

  let payload: RequestPasswordResetPayload;
  try {
    payload = (await request.json()) as RequestPasswordResetPayload;
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
    key: `v1:auth:reset:email:${emailHash}`,
    maxHits: 3,
    windowSeconds: 600,
    errorMessage: "Too many requests for this email. Please try again later.",
  });
  if (emailLimited) return emailLimited;

  const redirectTo = `${getRequestBaseUrl(request)}/auth/callback?next=/auth/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
