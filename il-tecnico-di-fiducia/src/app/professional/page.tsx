import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { StartCheckoutButton } from "@/components/billing/start-checkout-button";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

export default async function ProfessionalHomePage() {
  const { profile } = await requirePageAuth({ allowedRoles: ["professional"] });

  return (
    <main className="min-h-screen pt-10 pb-16 px-4 bg-background">
      <div className="max-w-[960px] mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="font-headline-md text-headline-md text-primary">
              Benvenuto, {profile.first_name}
            </div>
            <div className="text-on-surface-variant">
              Gestisci la tua attività e i messaggi.
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
          <div className="font-headline-sm text-primary mb-1">Visibilità profilo</div>
          <p className="text-on-surface-variant">
            I professionisti vengono mostrati ai clienti in base allo stato di abbonamento e
            alle regole RLS. Se non sei ancora visibile, completa la sottoscrizione.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <StartCheckoutButton className="font-button text-button bg-[#FF8500] text-white px-6 py-3 rounded-full hover:bg-[#FF9A2B] transition-colors text-center disabled:opacity-60">
              Attiva abbonamento
            </StartCheckoutButton>
            <Link
              href="/messages"
              className="font-button text-button border-2 border-primary text-primary px-6 py-3 rounded-full hover:bg-primary hover:text-white transition-colors text-center"
            >
              Vai ai messaggi
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
