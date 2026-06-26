import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Clienti"
      subtitle="Cerca, verifica e gestisci account cliente reali."
      adminName={profile.first_name || profile.email}
    >
      <AdminUsersClient role="customer" />
    </AdminShell>
  );
}
