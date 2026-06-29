import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

import AdminManagementClient from "./admin-management-client";

export const dynamic = "force-dynamic";

export default async function AdminAdministratorsPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Admin"
      subtitle="Gestisci amministratori reali e password provvisorie."
      adminName={profile.first_name || profile.email}
    >
      <AdminManagementClient />
    </AdminShell>
  );
}
