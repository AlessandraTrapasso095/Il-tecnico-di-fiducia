import type { Metadata } from "next";
import Link from "next/link";

import { ProposeTechnicianCta } from "@/components/public-pages/propose-technician-cta";
import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Proponi un tecnico | Il Tecnico di Fiducia",
  description:
    "Proponi una nuova figura professionale da valutare per ampliare la rete de Il Tecnico di Fiducia.",
};

const infoCards = [
  {
    icon: "hub",
    title: "Amplia la rete",
    body: "Segnala una figura professionale che ritieni utile per clienti e territori oggi non ancora coperti in modo adeguato.",
  },
  {
    icon: "workspace_premium",
    title: "Dai visibilità alla professione",
    body: "Aiutaci a intercettare competenze tecniche specializzate che meritano uno spazio più chiaro e riconoscibile.",
  },
  {
    icon: "auto_awesome",
    title: "Migliora la piattaforma",
    body: "Ogni proposta utile contribuisce a rendere la ricerca più completa, precisa e vicina alle esigenze reali.",
  },
];

const faqs = [
  {
    question: "Quali professioni posso proporre?",
    answer:
      "Puoi proporre figure tecniche, consulenziali o specialistiche che ritieni coerenti con la piattaforma e non ancora presenti tra le categorie disponibili.",
  },
  {
    question: "Cosa accade dopo l’invio?",
    answer:
      "La proposta viene presa in carico per una valutazione interna. Il team verifica coerenza, utilità, chiarezza della categoria e possibili implicazioni operative.",
  },
  {
    question: "Il contributo è rimborsabile?",
    answer:
      "Il contributo copre l’attività di analisi e valutazione della proposta. Non rappresenta un acquisto della categoria e non garantisce automaticamente l’inserimento.",
  },
  {
    question: "Posso proporre più professioni?",
    answer:
      "Sì, è possibile proporre più figure professionali, purché ogni proposta sia distinta, motivata e riferita a un’esigenza reale.",
  },
  {
    question: "Quanto tempo richiede la valutazione?",
    answer:
      "I tempi possono variare in base alla complessità della proposta e alle verifiche necessarie. L’obiettivo è valutare ogni richiesta con attenzione.",
  },
  {
    question: "La categoria verrà sicuramente aggiunta?",
    answer:
      "No. La proposta viene analizzata, ma l’inserimento dipende dalla coerenza con il progetto, dalla domanda potenziale e dalla sostenibilità della gestione sulla piattaforma.",
  },
];

export default function SuggestTechnicianPage() {
  return (
    <PublicPageShell
      eyebrow="Proponi un tecnico"
      title="Proponi una nuova figura professionale"
      description="Aiutaci ad ampliare la rete di professionisti presenti sulla piattaforma."
    >
      <Container className="py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[32px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_60px_rgba(8,43,95,0.10)] sm:p-8">
            <p className="font-label-md text-sm uppercase tracking-[0.18em] text-[#FF8500]">
              Come funziona
            </p>
            <h2 className="mt-3 font-headline-md text-[32px] leading-tight text-primary sm:text-[40px]">
              Una proposta seria, chiara e valutabile.
            </h2>
            <div className="mt-5 space-y-4 leading-7 text-on-surface-variant">
              <p>
                Se non trovi una categoria professionale che ritieni importante, puoi
                suggerirla al team de Il Tecnico di Fiducia. La proposta aiuta a capire
                quali competenze il mercato sta cercando e quali figure potrebbero
                arricchire la piattaforma.
              </p>
              <p>
                Il contributo di €4,99 serve a rendere l’invio serio e consapevole e a
                coprire l’attività di analisi. Non garantisce automaticamente
                l’inserimento, non è un acquisto della categoria e non crea un rapporto
                professionale con la piattaforma.
              </p>
            </div>
            <div className="mt-6 rounded-2xl bg-surface-container-low p-4 text-sm leading-6 text-primary">
              Il checkout non è ancora attivo in questa fase: il pulsante è predisposto
              per il prossimo collegamento server-side a Stripe.
            </div>
          </section>

          <ProposeTechnicianCta />
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {infoCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[28px] border border-outline-variant/30 bg-white p-6 shadow-[0_10px_40px_rgba(8,43,95,0.08)]"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-[#FF8500] text-white">
                <span className="material-symbols-outlined" aria-hidden>
                  {card.icon}
                </span>
              </div>
              <h2 className="font-headline-sm text-[24px] text-primary">{card.title}</h2>
              <p className="mt-3 leading-7 text-on-surface-variant">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 rounded-[32px] bg-primary p-6 text-white sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-label-md text-sm uppercase tracking-[0.18em] text-on-tertiary-container">
                FAQ
              </p>
              <h2 className="mt-3 font-headline-md text-[32px] leading-tight sm:text-[40px]">
                Domande frequenti sulle proposte.
              </h2>
              <p className="mt-4 leading-7 text-primary-fixed">
                Hai dubbi sul funzionamento? Qui trovi le risposte principali prima di
                inviare una proposta.
              </p>
            </div>
            <div className="grid gap-4">
              {faqs.map((faq) => (
                <article
                  key={faq.question}
                  className="rounded-2xl border border-white/15 bg-white/10 p-5"
                >
                  <h3 className="font-headline-sm text-[21px] leading-tight">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-primary-fixed">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 text-center">
          <p className="mx-auto max-w-2xl leading-7 text-on-surface-variant">
            Per domande generali o segnalazioni non legate alla proposta di una nuova
            professione, puoi usare la pagina{" "}
            <Link href="/contattaci" className="font-semibold text-primary underline">
              Contattaci
            </Link>
            .
          </p>
        </section>
      </Container>
    </PublicPageShell>
  );
}
