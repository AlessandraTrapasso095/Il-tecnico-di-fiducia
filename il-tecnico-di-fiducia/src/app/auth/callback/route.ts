import { NextResponse, type NextRequest } from "next/server";

import { safeAuthCallbackNextPath } from "@/lib/auth/callback-navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthCallbackNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth-callback] Session exchange failed", {
        message: error.message,
      });

      const errorUrl = new URL("/auth/error", url.origin);
      errorUrl.searchParams.set(
        "message",
        "Non è stato possibile completare l’accesso. Riprova.",
      );
      return NextResponse.redirect(errorUrl);
    }

    // If the user was banned, clear the session and fail closed.
    const { data: isActive } = await supabase.rpc("is_active_user");
    if (!isActive) {
      await supabase.auth.signOut();
      const errorUrl = new URL("/auth/error", url.origin);
      errorUrl.searchParams.set("message", "Account disabled");
      return NextResponse.redirect(errorUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
