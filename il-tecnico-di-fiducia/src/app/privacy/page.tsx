import type { Metadata } from "next";

import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Privacy Policy | Il Tecnico di Fiducia",
  description:
    "Informativa privacy di Il Tecnico di Fiducia per clienti, professionisti e visitatori.",
};

const PRIVACY_SECTIONS = [
  {
    title: "1. Titolare del trattamento e contatti",
    content: [
      "Il titolare del trattamento è il gestore del portale Il Tecnico di Fiducia, contattabile all’indirizzo admin@iltecnicodifiducia.it per richieste relative alla protezione dei dati personali, all’esercizio dei diritti dell’interessato e alle segnalazioni sulla gestione dei dati.",
      "La presente informativa descrive come vengono trattati i dati personali raccolti attraverso il sito, le aree riservate, i moduli pubblici e le funzionalità di piattaforma.",
    ],
  },
  {
    title: "2. Tipologie di dati trattati",
    content: [
      "Dati identificativi e di contatto: nome, cognome, indirizzo email, numero di telefono, provincia/località e informazioni inserite nel profilo.",
      "Dati account e autenticazione: credenziali gestite tramite Supabase Auth, conferme email, reset password, sessioni e stato dell’account.",
      "Dati professionali: professione, categorie, sottocategorie, bio, disponibilità, curriculum se caricato e impostazioni di visibilità del profilo.",
      "Contenuti generati dagli utenti: richieste, messaggi, allegati, post, commenti, recensioni, risposte alle recensioni, preventivi e ticket assistenza.",
      "Dati di pagamento professionista: informazioni necessarie alla gestione dell’abbonamento, elaborate tramite Stripe. Il portale non conserva i dati completi delle carte di pagamento.",
      "Dati tecnici: indirizzi IP, log applicativi, eventi di sicurezza, identificatori di sessione, informazioni su dispositivo/browser e dati necessari a prevenire abusi o accessi non autorizzati.",
    ],
  },
  {
    title: "3. Finalità del trattamento",
    content: [
      "Consentire la navigazione pubblica e l’uso delle pagine informative del sito.",
      "Permettere registrazione, autenticazione, gestione account e recupero password per clienti, professionisti e amministratori.",
      "Mostrare ai clienti professionisti visibili secondo le regole del servizio, incluse ricerca, filtri, preferiti, recensioni e informazioni pubbliche del profilo.",
      "Consentire l’invio e la gestione di richieste, conversazioni, allegati, notifiche, preventivi, recensioni e risposte.",
      "Gestire ticket di assistenza e richieste inviate dal modulo Contattaci, anche da utenti non registrati.",
      "Inviare email transazionali e notifiche necessarie al funzionamento del servizio, come conferme, risposte supporto, messaggi rilevanti, preventivi e avvisi di sicurezza.",
      "Gestire abbonamenti professionista, checkout, portale di pagamento e aggiornamenti di stato provenienti da Stripe.",
      "Garantire sicurezza, integrità della piattaforma, prevenzione di abusi, verifica di ruoli e rispetto delle policy di accesso ai dati.",
    ],
  },
  {
    title: "4. Base giuridica",
    content: [
      "Esecuzione del servizio richiesto dall’utente: gestione account, ricerca professionisti, richieste, chat, supporto, recensioni e abbonamenti.",
      "Adempimento di obblighi legali, fiscali, contabili o di sicurezza quando applicabili alle funzionalità utilizzate.",
      "Legittimo interesse del titolare alla protezione della piattaforma, prevenzione frodi, gestione log tecnici, sicurezza degli account e continuità del servizio.",
      "Consenso dell’interessato quando richiesto per specifiche comunicazioni o per trattamenti non strettamente necessari.",
    ],
  },
  {
    title: "5. Modalità del trattamento e sicurezza",
    content: [
      "I dati sono trattati con strumenti informatici e procedure organizzative proporzionate alla natura del servizio. L’accesso ai dati è limitato agli utenti autorizzati e alle funzioni strettamente necessarie.",
      "Il progetto utilizza controlli applicativi, autenticazione, ruoli, policy di accesso ai dati, log server-side e regole di sicurezza Supabase per limitare la visibilità delle informazioni a clienti, professionisti e amministratori autorizzati.",
      "Le email transazionali vengono inviate lato server. Le chiavi tecniche, le credenziali SMTP, le chiavi Supabase service role e le chiavi Stripe sono configurate come variabili server e non devono essere esposte nel browser.",
    ],
  },
  {
    title: "6. Conservazione dei dati",
    content: [
      "I dati account e profilo sono conservati finché l’account resta attivo o finché sono necessari per erogare il servizio richiesto.",
      "Messaggi, richieste, ticket, preventivi e recensioni possono essere conservati per mantenere lo storico delle interazioni, garantire sicurezza, gestire contestazioni e preservare l’integrità della piattaforma.",
      "Log tecnici e dati di sicurezza sono conservati per il tempo necessario a diagnosticare problemi, prevenire abusi e proteggere il servizio.",
      "In caso di eliminazione account, i dati vengono cancellati, anonimizzati o conservati nei limiti necessari a obblighi tecnici, amministrativi, fiscali o di sicurezza, secondo le regole implementate nel sistema.",
    ],
  },
  {
    title: "7. Comunicazione dei dati",
    content: [
      "I dati possono essere comunicati ai professionisti o ai clienti solo quando necessario per gestire richieste, conversazioni, preventivi, recensioni e funzioni collegate.",
      "Gli amministratori autorizzati possono accedere ai dati necessari per moderazione, assistenza, sicurezza, gestione utenti, abbonamenti e ticket.",
      "I dati possono essere trattati da fornitori tecnici che erogano servizi indispensabili al funzionamento della piattaforma, come hosting, database, autenticazione, storage, pagamenti ed email transazionali.",
    ],
  },
  {
    title: "8. Servizi terzi utilizzati",
    content: [
      "Supabase è utilizzato per autenticazione, database, storage, sessioni, realtime e policy di accesso ai dati.",
      "Stripe è utilizzato per il checkout, la gestione degli abbonamenti professionista, il portale di pagamento, i webhook e gli stati di sottoscrizione.",
      "Vercel e Next.js sono utilizzati per hosting, rendering del sito e infrastruttura applicativa.",
      "Nodemailer e il server SMTP configurato sul dominio sono utilizzati per inviare email transazionali lato server.",
      "Le immagini esterne eventualmente mostrate nelle pagine pubbliche o nei profili possono comportare richieste tecniche verso il dominio che ospita l’immagine.",
    ],
  },
  {
    title: "9. Stripe e pagamenti",
    content: [
      "I dati di pagamento dell’abbonamento professionista sono gestiti da Stripe. Durante il checkout l’utente viene indirizzato all’ambiente Stripe, dove si applicano anche le informative e condizioni del fornitore di pagamento.",
      "Il portale riceve da Stripe informazioni sullo stato dell’abbonamento, come attivo, annullato, sospeso o scaduto, necessarie per regolare la visibilità del professionista e l’accesso alle funzionalità collegate.",
    ],
  },
  {
    title: "10. Cookie e strumenti tecnici",
    content: [
      "Il sito utilizza cookie e strumenti tecnici necessari per autenticazione, sicurezza, mantenimento della sessione, navigazione e funzionamento delle aree riservate.",
      "Non risultano implementati strumenti di analytics, profilazione pubblicitaria o tracciamento marketing nel codice del progetto.",
      "Ulteriori dettagli sono disponibili nella Cookie Policy pubblica.",
    ],
  },
  {
    title: "11. Diritti dell’interessato",
    content: [
      "L’utente può richiedere accesso ai dati personali, rettifica, cancellazione, limitazione del trattamento, opposizione, portabilità dei dati quando applicabile e revoca del consenso per i trattamenti basati su consenso.",
      "Le richieste possono essere inviate a admin@iltecnicodifiducia.it. Per tutelare gli account, il titolare può richiedere informazioni necessarie a verificare l’identità del richiedente prima di eseguire la richiesta.",
    ],
  },
  {
    title: "12. Aggiornamenti dell’informativa",
    content: [
      "La Privacy Policy può essere aggiornata per riflettere modifiche del servizio, adeguamenti tecnici o nuove funzionalità. La versione pubblicata sul sito è quella applicabile al momento della consultazione.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      description="Informativa sul trattamento dei dati personali per visitatori, clienti, professionisti e amministratori che utilizzano Il Tecnico di Fiducia."
    >
      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-5">
          {PRIVACY_SECTIONS.map((section) => (
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
