import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { logApiError } from "@/lib/server/api-logger";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );

          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          }
        },
      },
    },
  );

  // Trigger refresh if needed (must be called before response commits).
  // A broken/stale auth cookie must not turn every API (including public ones)
  // into a hard 500 before the route handler can answer.
  try {
    const { error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      logApiError("SESSION UPDATE ERROR", {
        path: request.nextUrl.pathname,
        query: request.nextUrl.search,
        error,
      });
    }
  } catch (error) {
    logApiError("SESSION UPDATE ERROR", {
      path: request.nextUrl.pathname,
      query: request.nextUrl.search,
      error,
    });
  }

  return response;
}
