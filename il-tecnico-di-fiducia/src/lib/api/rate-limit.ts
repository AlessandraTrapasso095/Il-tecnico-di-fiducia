import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashRateLimitId(id: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? "";
  return sha256Hex(`${salt}${id}`);
}

function firstForwardedIp(header: string) {
  // X-Forwarded-For may contain a comma-separated list.
  // We take the first public-ish token.
  const parts = header.split(",").map((p) => p.trim());
  return parts.find(Boolean) ?? null;
}

export function getClientIp(request: Request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) return firstForwardedIp(xff) ?? "0.0.0.0";

  return "0.0.0.0";
}

type EnforceRateLimitArgs = {
  supabase: SupabaseClient;
  key: string;
  maxHits: number;
  windowSeconds: number;
  errorMessage?: string;
};

export async function enforceRateLimit({
  supabase,
  key,
  maxHits,
  windowSeconds,
  errorMessage = "Too many requests",
}: EnforceRateLimitArgs): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const builder = supabase.rpc("rate_limit_check", {
    p_key: key,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  }) as unknown as {
    maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await builder.maybeSingle();

  // Fail open if rate limiting isn't available; do not block auth.
  if (error || !data) return null;

  const row = data as unknown as {
    allowed?: boolean;
    remaining?: number;
    reset_at?: string | null;
  };

  if (typeof row.allowed !== "boolean") return null;
  if (row.allowed) return null;

  const resetAt = row.reset_at ? new Date(row.reset_at).getTime() : null;
  const retryAfterSeconds =
    resetAt && Number.isFinite(resetAt)
      ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      : windowSeconds;

  return NextResponse.json(
    { error: errorMessage },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}
