import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { isNonEmptyString } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";

type AdminSignInPayload = {
  email: string;
  password: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:admin:signin:ip:${ip}`,
    maxHits: 20,
    windowSeconds: 300,
    errorMessage: "IP admin login rate limit exceeded. Please try again later.",
  });
  if (ipLimited) return ipLimited;

  let payload: AdminSignInPayload;
  try {
    payload = (await request.json()) as AdminSignInPayload;
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
  const emailHash = await hashRateLimitId(`admin-email:${normalizedEmail}`);
  const emailLimited = await enforceRateLimit({
    supabase,
    key: `v1:admin:signin:email:${emailHash}`,
    maxHits: 10,
    windowSeconds: 600,
    errorMessage: "Email admin login rate limit exceeded. Please try again later.",
  });
  if (emailLimited) return emailLimited;

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: payload.password,
  });

  if (error) {
    return NextResponse.json({ error: "Credenziali admin non valide." }, { status: 400 });
  }

  const auth = await requireAuth({ allowMustChangePassword: true });
  if (!auth.ok) return auth.response;

  if (auth.ctx.profile.role !== "admin") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Questo account non ha permessi admin." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: { id: auth.ctx.user.id, email: auth.ctx.user.email },
    profile: auth.ctx.profile,
  });
}
