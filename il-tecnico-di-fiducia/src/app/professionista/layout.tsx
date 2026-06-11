import type { ReactNode } from "react";

import ProfessionalShell from "./professional-shell";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function ProfessionalAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requirePageAuth({ allowedRoles: ["professional"] });

  return (
    <ProfessionalShell
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
        phone: profile.phone,
      }}
    >
      {children}
    </ProfessionalShell>
  );
}
