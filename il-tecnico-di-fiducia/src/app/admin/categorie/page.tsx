import { AdminCategoriesClient } from "@/components/admin/admin-categories-client";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Categorie e professioni"
      subtitle="Gestisci il catalogo professionale e prepara le sottocategorie amministrabili."
      adminName={profile.first_name || profile.email}
    >
      <AdminCategoriesClient />
    </AdminShell>
  );
}
