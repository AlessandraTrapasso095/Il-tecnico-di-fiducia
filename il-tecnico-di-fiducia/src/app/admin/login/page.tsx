import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import AdminLoginClient from "./admin-login-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : null;
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

  return (
    <AdminLoginClient
      infoMessage={reason === "inactive" ? "Sessione terminata per inattività." : null}
    />
  );
}
