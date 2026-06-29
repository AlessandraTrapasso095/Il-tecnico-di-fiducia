import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { UserRole, ViewerProfile } from "@/lib/api/auth";
import { nextPathByRole } from "@/lib/routes/role-paths";
import { createClient } from "@/lib/supabase/server";

export type PageAuthContext = {
  supabase: SupabaseClient;
  user: User;
  profile: ViewerProfile;
};

type RequirePageAuthOptions = {
  allowedRoles?: UserRole[];
  allowMustChangePassword?: boolean;
  loginPath?: string;
};

export async function requirePageAuth(
  options: RequirePageAuthOptions = {},
): Promise<PageAuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(options.loginPath ?? "/auth/login");
  }

  const { data: isActive } = await supabase.rpc("is_active_user");
  if (!isActive) {
    await supabase.auth.signOut();
    redirect(options.loginPath ?? "/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, suspended_until",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect(options.loginPath ?? "/auth/login");
  }

  if (options.allowedRoles && !options.allowedRoles.includes(profile.role)) {
    redirect(nextPathByRole(profile.role));
  }

  if (
    profile.role === "admin" &&
    profile.must_change_password &&
    options.allowMustChangePassword !== true
  ) {
    redirect("/auth/change-password");
  }

  return { supabase, user, profile: profile as ViewerProfile };
}
