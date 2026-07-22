import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

const PRIVACY_SECTIONS = [
  {
    title: "1. Titolare del trattamento",
    body: "PLACEHOLDER GDPR: indicare ragione sociale, sede, contatti privacy e canali ufficiali del titolare del trattamento.",
  },
  {
    title: "2. Dati personali trattati",
    body: "PLACEHOLDER GDPR: descrivere dati account, dati di contatto, messaggi, richieste, recensioni, dati tecnici, log e dati necessari alla sicurezza della piattaforma.",
  },
  {
    title: "3. Finalità e basi giuridiche",
    body: "PLACEHOLDER GDPR: indicare finalità di erogazione servizio, gestione account, supporto, pagamenti, sicurezza, obblighi legali e comunicazioni transazionali.",
  },
  {
    title: "4. Conservazione dei dati",
    body: "PLACEHOLDER GDPR: specificare tempi di conservazione per account, ticket, messaggi, contenuti, pagamenti e log tecnici.",
  },
  {
    title: "5. Responsabili e fornitori",
    body: "PLACEHOLDER GDPR: elencare categorie di fornitori come hosting, Supabase, Stripe, SMTP/email e strumenti tecnici necessari al funzionamento.",
  },
  {
    title: "6. Diritti dell’interessato",
    body: "PLACEHOLDER GDPR: descrivere accesso, rettifica, cancellazione, limitazione, opposizione, portabilità e reclamo all’autorità competente.",
  },
  {
    title: "7. Sicurezza",
    body: "PLACEHOLDER GDPR: descrivere misure tecniche e organizzative, accessi limitati, logging, policy RLS e protezione delle comunicazioni.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      description="Informativa privacy in struttura GDPR. I testi sono placeholder espliciti da completare con la versione legale definitiva."
    >
      <Container className="py-12 lg:py-16">
        <div className="rounded-[28px] border border-tertiary/20 bg-tertiary-fixed p-5 text-on-tertiary-fixed-variant sm:p-6">
          Documento placeholder GDPR: completare con dati aziendali, basi giuridiche,
          fornitori e tempi di conservazione definitivi.
        </div>
        <div className="mt-8 space-y-5">
          {PRIVACY_SECTIONS.map((section) => (
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
