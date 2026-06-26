import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminProfessionalsPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Professionisti"
      subtitle="Gestisci visibilità, sospensioni e stato abbonamento."
      adminName={profile.first_name || profile.email}
    >
      <AdminUsersClient role="professional" />
    </AdminShell>
  );
}
