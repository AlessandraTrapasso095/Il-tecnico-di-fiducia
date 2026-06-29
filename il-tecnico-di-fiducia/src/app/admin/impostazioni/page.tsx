import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

import AdminSettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { supabase, profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("new_requests, messages, reviews, email")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <AdminShell
      title="Impostazioni"
      subtitle="Gestisci profilo, notifiche e cancellazione account."
      adminName={profile.first_name || profile.email}
    >
      <AdminSettingsClient
        profile={{
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        }}
        preferences={{
          new_requests: preferences?.new_requests ?? true,
          messages: preferences?.messages ?? true,
          reviews: preferences?.reviews ?? true,
          email: preferences?.email ?? true,
        }}
      />
    </AdminShell>
  );
}
