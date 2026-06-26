import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

import AdminSupportClient from "./support-client";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Supporto"
      subtitle="Gestisci ticket reali inviati dagli utenti."
      adminName={profile.first_name || profile.email}
    >
      <AdminSupportClient />
    </AdminShell>
  );
}
