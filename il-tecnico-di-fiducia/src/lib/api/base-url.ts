import "server-only";

// Prefer a configured public URL when available (useful behind proxies / in serverless).
// Falls back to Origin/Host for local development.
export function getRequestBaseUrl(request: Request) {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? null;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const host = request.headers.get("host");
  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

