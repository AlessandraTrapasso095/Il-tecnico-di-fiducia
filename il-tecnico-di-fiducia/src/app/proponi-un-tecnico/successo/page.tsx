import type { Metadata } from "next";
import Link from "next/link";

import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Proposta ricevuta | Il Tecnico di Fiducia",
  description:
    "Conferma di ricezione della proposta di una nuova figura professionale.",
};

export default function ProfessionSuggestionSuccessPage() {
  return (
    <PublicPageShell
      eyebrow="Proposta ricevuta"
      title="Grazie per la tua proposta."
      description="Il nostro team valuterà la figura professionale indicata e ti aggiornerà tramite email."
    >
      <Container className="py-14 lg:py-20">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-outline-variant/30 bg-white p-6 text-center shadow-[0_18px_60px_rgba(8,43,95,0.12)] sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <span className="material-symbols-outlined" aria-hidden>
              check
            </span>
          </div>
          <h2 className="mt-5 font-headline-md text-[30px] leading-tight text-primary">
            Pagamento completato
          </h2>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Abbiamo registrato la tua proposta. Riceverai una conferma via email e il
            team valuterà la figura professionale indicata.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF8500] px-7 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B]"
          >
            Torna alla home
          </Link>
        </div>
      </Container>
    </PublicPageShell>
  );
}
