import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type UserRole = "customer" | "professional" | "admin";

export type ViewerProfile = {
  id: string;
  role: UserRole;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  suspended_until: string | null;
};

export type ApiAuthContext = {
  supabase: SupabaseClient;
  user: User;
  profile: ViewerProfile;
};

type RequireAuthOptions = {
  allowedRoles?: UserRole[];
  allowMustChangePassword?: boolean;
};

type RequireAuthResult =
  | { ok: true; ctx: ApiAuthContext }
  | { ok: false; response: NextResponse };

export async function requireAuth(
  options: RequireAuthOptions = {},
): Promise<RequireAuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: isActive, error: activeError } = await supabase.rpc(
    "is_active_user",
  );

  if (activeError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to validate session" },
        { status: 500 },
      ),
    };
  }

  if (!isActive) {
    // Best-effort sign-out to clear cookies for banned users.
    await supabase.auth.signOut();
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, suspended_until",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 },
      ),
    };
  }

  if (options.allowedRoles && !options.allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  // Enforce admin password rotation if requested by the app (fail-closed for admin-only routes).
  if (
    profile.role === "admin" &&
    profile.must_change_password &&
    options.allowMustChangePassword !== true
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Password change required" },
        { status: 428 },
      ),
    };
  }

  // Best-effort activity ping (used for admin "online/offline" indicators).
  // Never block API requests on presence tracking.
  try {
    await supabase.rpc("touch_user_activity");
  } catch {
    // ignore
  }

  return {
    ok: true,
    ctx: {
      supabase,
      user,
      profile: profile as ViewerProfile,
    },
  };
}
