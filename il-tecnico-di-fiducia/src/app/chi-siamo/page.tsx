import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/site/container";
import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";

export const metadata: Metadata = {
  title: "Chi siamo | Il Tecnico di Fiducia",
  description:
    "La storia de Il Tecnico di Fiducia, nato dall’idea di Davide Mazza per avvicinare clienti e professionisti qualificati.",
};

const values = [
  {
    title: "Chiarezza",
    body: "Aiutiamo chi cerca un tecnico a orientarsi tra competenze, località e disponibilità senza affidarsi solo al caso.",
  },
  {
    title: "Fiducia",
    body: "Mettiamo al centro profili reali, richieste tracciabili, recensioni e strumenti di contatto ordinati.",
  },
  {
    title: "Crescita",
    body: "Costruiamo una rete che può evolvere con nuove figure professionali e con i bisogni concreti degli utenti.",
  },
];

const sections = [
  {
    title: "Il problema che vogliamo risolvere",
    body: "Trovare il professionista giusto non dovrebbe dipendere soltanto da un passaparola fortunato. Spesso chi ha bisogno di un tecnico non sa dove cercare, quali competenze valutare o come confrontare profili diversi. Allo stesso tempo, molti professionisti qualificati faticano a farsi conoscere fuori dalla propria cerchia.",
  },
  {
    title: "Una rete costruita sulla fiducia",
    body: "Il Tecnico di Fiducia nasce per creare un luogo semplice e affidabile in cui domanda e competenza possano incontrarsi. La piattaforma organizza profili, categorie, località, richieste e recensioni per rendere più naturale il primo contatto tra cliente e professionista.",
  },
  {
    title: "Per i clienti",
    body: "Chi cerca un tecnico può scoprire professionisti attivi, leggere informazioni utili, inviare una richiesta e gestire la comunicazione in un ambiente ordinato. L’obiettivo è ridurre incertezza e perdita di tempo, mantenendo il controllo della scelta.",
  },
  {
    title: "Per i professionisti",
    body: "I professionisti possono presentare competenze, esperienza e servizi in modo più strutturato, raggiungendo persone che hanno una necessità reale. La piattaforma non sostituisce la professionalità: la rende più visibile e più facile da incontrare.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-surface">
      <TopNav />
      <main className="flex-1 pt-20 sm:pt-[100px]">
        <section className="relative overflow-hidden bg-primary py-16 text-white sm:py-20 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,133,0,0.26),transparent_32%),linear-gradient(135deg,#002654,#0b3c78)]" />
          <Container className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="font-label-md text-sm uppercase tracking-[0.18em] text-on-tertiary-container">
                Chi siamo
              </p>
              <h1 className="mt-4 font-display-lg text-[42px] leading-tight sm:text-[58px]">
                Un ponte tra chi cerca competenza e chi la offre ogni giorno.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-fixed">
                Il Tecnico di Fiducia nasce dall’esperienza professionale di Davide
                Mazza, ingegnere civile, e da un’esigenza concreta: rendere più
                semplice l’incontro tra clienti e professionisti specializzati.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -left-5 -top-5 h-28 w-28 rounded-full bg-[#FF8500]/30 blur-2xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-white/10 shadow-2xl">
                <Image
                  src="/img/ponte-catanzaro.jpg"
                  alt="Infrastruttura tecnica sul territorio, simbolo del collegamento tra clienti e professionisti"
                  width={1024}
                  height={542}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </Container>
        </section>

        <section className="py-14 sm:py-20">
          <Container className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
            <aside className="rounded-[32px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_60px_rgba(8,43,95,0.10)] sm:p-8">
              <div className="flex items-center gap-4">
                <Image
                  src="/img/davide-mazza.jpg"
                  alt="Davide Mazza, fondatore de Il Tecnico di Fiducia"
                  width={96}
                  height={96}
                  className="size-24 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
                    L’idea
                  </p>
                  <h2 className="font-headline-sm text-[25px] leading-tight text-primary">
                    Davide Mazza
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Ingegnere civile di professione
                  </p>
                </div>
              </div>
              <p className="mt-6 leading-7 text-on-surface-variant">
                Durante la sua esperienza professionale, Davide ha osservato una
                difficoltà ricorrente: clienti con bisogni concreti e professionisti
                preparati spesso non riescono a incontrarsi nel momento giusto e nel
                modo giusto.
              </p>
            </aside>

            <div className="space-y-5">
              <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
                La nostra storia
              </p>
              <h2 className="font-headline-md text-[34px] leading-tight text-primary sm:text-[42px]">
                Dal passaparola a uno spazio più ordinato, accessibile e trasparente.
              </h2>
              <p className="text-lg leading-8 text-on-surface-variant">
                Per molte persone trovare il tecnico adatto significa chiedere ad amici,
                parenti o conoscenti, sperando che il nome suggerito sia davvero quello
                giusto. Il passaparola resta prezioso, ma non sempre basta: le esigenze
                possono essere specifiche, urgenti o legate a competenze particolari.
              </p>
              <p className="text-lg leading-8 text-on-surface-variant">
                Da questa consapevolezza nasce Il Tecnico di Fiducia: una piattaforma
                pensata per mettere ordine, dare visibilità ai professionisti qualificati
                e offrire ai clienti un percorso più semplice per iniziare un contatto.
              </p>
            </div>
          </Container>
        </section>

        <section className="bg-surface-container-low py-14 sm:py-20">
          <Container>
            <div className="grid gap-6 md:grid-cols-3">
              {values.map((value) => (
                <article
                  key={value.title}
                  className="rounded-[28px] border border-outline-variant/30 bg-white p-6 shadow-[0_10px_40px_rgba(8,43,95,0.08)]"
                >
                  <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-[#FF8500] text-white">
                    <span className="material-symbols-outlined" aria-hidden>
                      handshake
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-[24px] text-primary">
                    {value.title}
                  </h2>
                  <p className="mt-3 leading-7 text-on-surface-variant">
                    {value.body}
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section className="py-14 sm:py-20">
          <Container className="grid gap-6 lg:grid-cols-2">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_10px_40px_rgba(8,43,95,0.06)] sm:p-8"
              >
                <h2 className="font-headline-sm text-[26px] leading-tight text-primary">
                  {section.title}
                </h2>
                <p className="mt-4 leading-7 text-on-surface-variant">
                  {section.body}
                </p>
              </article>
            ))}
          </Container>
        </section>

        <section className="bg-primary py-14 text-white sm:py-20">
          <Container className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-label-md text-sm uppercase tracking-[0.18em] text-on-tertiary-container">
                La nostra visione
              </p>
              <h2 className="mt-3 font-headline-md text-[34px] leading-tight sm:text-[42px]">
                Un progetto in continua crescita.
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-primary-fixed">
                Vogliamo far crescere una rete utile, concreta e credibile, capace di
                valorizzare le competenze tecniche e aiutare le persone a scegliere con
                maggiore consapevolezza.
              </p>
            </div>
            <Link
              href="/#professioni"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF8500] px-7 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B]"
            >
              Cerca un tecnico
            </Link>
          </Container>
        </section>
      </main>
      <Footer />
    </div>
  );
}
