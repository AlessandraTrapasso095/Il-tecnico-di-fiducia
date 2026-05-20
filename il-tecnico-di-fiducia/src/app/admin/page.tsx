import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["admin"] });

  return (
    <main className="min-h-screen pt-10 pb-16 px-4 bg-background">
      <div className="max-w-[960px] mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="font-headline-md text-headline-md text-primary">
              Admin Panel
            </div>
            <div className="text-on-surface-variant">
              Ciao {profile.first_name || "Admin"}.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="font-button text-button border-2 border-primary text-primary px-5 py-3 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              Messaggi
            </Link>
            <SignOutButton className="font-button text-button text-error px-5 py-3 rounded-full hover:bg-error-container/30 transition-colors">
              Logout
            </SignOutButton>
          </div>
        </header>

        <section className="bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
          <div className="font-headline-sm text-primary mb-2">Azioni</div>
          <ul className="list-disc list-inside text-on-surface-variant space-y-1">
            <li>Gestione utenti e ticket (UI completa nel prossimo step).</li>
            <li>Forzatura/sospensione abbonamenti professionisti.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

