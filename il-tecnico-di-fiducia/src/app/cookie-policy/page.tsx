import type { Metadata } from "next";

import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Cookie Policy | Il Tecnico di Fiducia",
  description:
    "Informazioni sui cookie tecnici e sugli strumenti necessari utilizzati da Il Tecnico di Fiducia.",
};

const COOKIE_SECTIONS = [
  {
    title: "1. Cosa sono i cookie",
    content: [
      "I cookie sono piccoli file di testo che un sito può salvare sul dispositivo dell’utente per consentire funzioni tecniche, mantenere una sessione, ricordare informazioni necessarie alla navigazione o abilitare servizi richiesti dall’utente.",
      "Strumenti con funzioni analoghe, come local storage o session storage, possono essere utilizzati dal browser per finalità tecniche simili.",
    ],
  },
  {
    title: "2. Cookie tecnici e necessari",
    content: [
      "Il Tecnico di Fiducia utilizza cookie e strumenti tecnici necessari al funzionamento del sito, alla sicurezza, alla gestione delle sessioni e all’accesso alle aree riservate.",
      "Questi strumenti sono indispensabili per consentire login, mantenimento della sessione, protezione degli accessi, corretta navigazione tra le pagine e funzionamento delle funzionalità richieste dall’utente.",
      "Poiché sono necessari all’erogazione del servizio, non richiedono consenso preventivo. L’utente può comunque disabilitarli dal browser, ma in tal caso login, dashboard, chat e aree riservate potrebbero non funzionare correttamente.",
    ],
  },
  {
    title: "3. Cookie di autenticazione Supabase",
    content: [
      "Il progetto utilizza Supabase per autenticazione e gestione sessioni. Supabase può impostare cookie tecnici necessari a riconoscere la sessione dell’utente e a consentire l’accesso sicuro alle aree cliente, professionista e admin.",
      "Questi cookie non sono usati per profilazione pubblicitaria e sono collegati esclusivamente alla sicurezza dell’account e alla continuità della sessione autenticata.",
    ],
  },
  {
    title: "4. Strumenti di memoria locale",
    content: [
      "Alcune funzioni tecniche possono usare la memoria locale del browser per coordinare comportamenti necessari, come la gestione della sessione tra più schede, il logout per inattività o stati temporanei dell’interfaccia.",
      "Questi dati sono usati per finalità operative e non per creare profili pubblicitari dell’utente.",
    ],
  },
  {
    title: "5. Cookie e servizi di terze parti",
    content: [
      "Il sito utilizza fornitori tecnici necessari al funzionamento della piattaforma: Supabase per autenticazione, database, storage e realtime; Stripe per pagamenti e abbonamenti professionista; Vercel e Next.js per hosting e distribuzione dell’applicazione.",
      "Quando il professionista viene reindirizzato a Stripe Checkout o al portale Stripe, l’ambiente di pagamento può utilizzare propri cookie e strumenti tecnici secondo le informative Stripe. Tali strumenti operano nel dominio o nell’ambiente Stripe e sono necessari alla gestione sicura del pagamento.",
      "Le email transazionali inviate tramite server SMTP non comportano l’installazione di cookie sul browser dell’utente.",
    ],
  },
  {
    title: "6. Cookie di analytics e marketing",
    content: [
      "Nel codice del progetto non risultano implementati strumenti di analytics, advertising, retargeting, pixel di marketing o cookie di profilazione.",
      "Se in futuro venissero introdotti strumenti non necessari, la Cookie Policy verrà aggiornata e, ove richiesto, verrà mostrato un meccanismo di consenso prima dell’attivazione.",
    ],
  },
  {
    title: "7. Gestione dal browser",
    content: [
      "L’utente può gestire, cancellare o bloccare i cookie attraverso le impostazioni del browser utilizzato. La disattivazione dei cookie tecnici può impedire l’accesso alle aree riservate o compromettere funzionalità come autenticazione, chat, notifiche e pagamenti.",
    ],
  },
  {
    title: "8. Contatti",
    content: [
      "Per richieste relative all’uso di cookie e strumenti tecnici è possibile scrivere a admin@iltecnicodifiducia.it.",
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Cookie"
      title="Cookie Policy"
      description="Informazioni sui cookie tecnici e sugli strumenti necessari utilizzati per far funzionare il sito e le aree riservate."
    >
      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-5">
          {COOKIE_SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.06)] sm:p-7"
            >
              <h2 className="font-headline-sm text-[24px] leading-tight text-primary">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-[15px] leading-7 text-on-surface-variant sm:text-base">
                {section.content.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </PublicPageShell>
  );
}
