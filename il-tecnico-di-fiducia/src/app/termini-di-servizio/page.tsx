import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

const TERMS_SECTIONS = [
  {
    title: "1. Oggetto del servizio",
    body: "PLACEHOLDER LEGALE: questa sezione descriverà le funzionalità offerte da Il Tecnico di Fiducia, il ruolo della piattaforma e le condizioni di utilizzo per clienti e professionisti.",
  },
  {
    title: "2. Registrazione e account",
    body: "PLACEHOLDER LEGALE: questa sezione specificherà requisiti di registrazione, responsabilità sulle credenziali, correttezza dei dati inseriti e gestione degli account.",
  },
  {
    title: "3. Rapporti tra clienti e professionisti",
    body: "PLACEHOLDER LEGALE: questa sezione chiarirà che accordi, preventivi, prestazioni e comunicazioni tra utenti seguono le condizioni accettate dalle parti.",
  },
  {
    title: "4. Abbonamenti e pagamenti",
    body: "PLACEHOLDER LEGALE: questa sezione riepilogherà abbonamenti professionista, pagamenti tramite Stripe, rinnovi, cancellazioni e fatturazione.",
  },
  {
    title: "5. Contenuti e recensioni",
    body: "PLACEHOLDER LEGALE: questa sezione definirà regole per post, commenti, recensioni, allegati e contenuti pubblicati dagli utenti.",
  },
  {
    title: "6. Limitazioni di responsabilità",
    body: "PLACEHOLDER LEGALE: questa sezione descriverà i limiti di responsabilità della piattaforma nei limiti consentiti dalla legge applicabile.",
  },
  {
    title: "7. Modifiche ai termini",
    body: "PLACEHOLDER LEGALE: questa sezione indicherà come verranno comunicate eventuali modifiche ai termini di servizio.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Termini"
      title="Termini di servizio"
      description="Struttura iniziale dei termini di utilizzo. I testi sono placeholder da sostituire con la versione legale definitiva."
    >
      <Container className="py-12 lg:py-16">
        <div className="rounded-[28px] border border-tertiary/20 bg-tertiary-fixed p-5 text-on-tertiary-fixed-variant sm:p-6">
          Documento placeholder: verificare e completare con consulente legale prima della
          pubblicazione definitiva.
        </div>
        <div className="mt-8 space-y-5">
          {TERMS_SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.06)] sm:p-6"
            >
              <h2 className="font-headline-sm text-[22px] text-primary">{section.title}</h2>
              <p className="mt-3 leading-7 text-on-surface-variant">{section.body}</p>
            </section>
          ))}
        </div>
      </Container>
    </PublicPageShell>
  );
}
