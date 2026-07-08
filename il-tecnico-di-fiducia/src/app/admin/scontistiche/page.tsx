import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

import DiscountCodesClient from "./discount-codes-client";

export const dynamic = "force-dynamic";

export default async function AdminDiscountCodesPage() {
  const { profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  return (
    <AdminShell
      title="Scontistiche"
      subtitle="Crea e gestisci codici sconto Stripe per gli abbonamenti professionisti."
      adminName={profile.first_name || profile.email}
    >
      <DiscountCodesClient />
    </AdminShell>
  );
}
