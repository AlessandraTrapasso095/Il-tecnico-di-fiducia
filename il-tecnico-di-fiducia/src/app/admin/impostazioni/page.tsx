import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { requirePageAuth } from "@/lib/server/require-page-auth";

import AdminSettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Impostazioni"
      subtitle="Gestisci account admin e crea nuovi amministratori."
      adminName={profile.first_name || profile.email}
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminSettingsClient
          profile={{
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
          }}
        />
        <AdminUsersClient role="admin" />
      </div>
    </AdminShell>
  );
}
