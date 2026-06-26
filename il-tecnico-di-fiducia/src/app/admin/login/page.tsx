import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import AdminLoginClient from "./admin-login-client";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      redirect(profile.must_change_password ? "/auth/change-password" : "/admin");
    }
  }

  return <AdminLoginClient />;
}
