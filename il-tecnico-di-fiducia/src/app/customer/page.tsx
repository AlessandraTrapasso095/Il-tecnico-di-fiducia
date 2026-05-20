import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["customer"] });

  return (
    <main className="min-h-screen pt-10 pb-16 px-4 bg-background">
      <div className="max-w-[960px] mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="font-headline-md text-headline-md text-primary">
              Ciao {profile.first_name}
            </div>
            <div className="text-on-surface-variant">
              Di cosa hai bisogno oggi?
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

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/messages"
            className="bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30 hover:shadow-md transition-shadow"
          >
            <div className="font-headline-sm text-primary mb-1">Cerca professionista</div>
            <div className="text-on-surface-variant">
              Avvia una nuova richiesta direttamente dalla chat.
            </div>
          </Link>

          <Link
            href="/messages"
            className="bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30 hover:shadow-md transition-shadow"
          >
            <div className="font-headline-sm text-primary mb-1">Messaggi</div>
            <div className="text-on-surface-variant">
              Gestisci le conversazioni attive con i tecnici.
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
