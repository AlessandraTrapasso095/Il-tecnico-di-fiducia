import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type SignInPayload = {
  email: string;
  password: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:signin:ip:${ip}`,
    maxHits: 20,
    windowSeconds: 300,
    errorMessage: "Too many login attempts. Please try again later.",
  });
  if (ipLimited) return ipLimited;

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

  const normalizedEmail = payload.email.trim().toLowerCase();
  const emailHash = await hashRateLimitId(`email:${normalizedEmail}`);
  const emailLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:signin:email:${emailHash}`,
    maxHits: 10,
    windowSeconds: 600,
    errorMessage: "Too many login attempts for this email. Please try again later.",
  });
  if (emailLimited) return emailLimited;

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
