import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HelpCenterRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/centro-assistenza");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    redirect("/admin/supporto");
  }

  if (profile?.role === "professional") {
    redirect("/professionista/supporto");
  }

  redirect("/contattaci");
}
