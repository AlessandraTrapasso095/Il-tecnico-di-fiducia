import type { Metadata } from "next";

import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "Termini di servizio | Il Tecnico di Fiducia",
  description:
    "Condizioni di utilizzo del portale Il Tecnico di Fiducia per clienti e professionisti.",
};

const TERMS_SECTIONS = [
  {
    title: "1. Ambito di applicazione",
    content: [
      "I presenti Termini regolano l’accesso e l’utilizzo del portale Il Tecnico di Fiducia, incluse la navigazione pubblica, la registrazione, le aree riservate, la ricerca dei professionisti, le richieste, la messaggistica, le recensioni, i ticket di assistenza e le funzionalità di abbonamento professionista.",
      "Utilizzando il portale, l’utente si impegna a rispettare questi Termini e le regole operative mostrate nelle diverse sezioni della piattaforma.",
    ],
  },
  {
    title: "2. Ruolo della piattaforma",
    content: [
      "Il Tecnico di Fiducia fornisce strumenti digitali per mettere in contatto clienti e professionisti, consultare profili, inviare richieste, gestire conversazioni, ricevere preventivi e pubblicare recensioni secondo le regole del servizio.",
      "La piattaforma non sostituisce le valutazioni professionali, tecniche, contrattuali o economiche delle parti. Cliente e professionista restano responsabili degli accordi presi tra loro, della correttezza delle informazioni scambiate e dell’esecuzione delle prestazioni concordate.",
    ],
  },
  {
    title: "3. Registrazione e account",
    content: [
      "La registrazione richiede dati veritieri, aggiornati e riferiti all’utente che crea l’account. L’utente è responsabile della custodia delle credenziali e di ogni attività svolta tramite il proprio account.",
      "Il portale distingue ruoli cliente, professionista e amministratore. Ogni area contiene funzionalità specifiche e protette da autenticazione e controlli di autorizzazione.",
      "Il gestore può sospendere o limitare account in caso di uso improprio, dati non veritieri, violazioni dei Termini, comportamenti abusivi o rischi per sicurezza e integrità della piattaforma.",
    ],
  },
  {
    title: "4. Obblighi dei clienti",
    content: [
      "Il cliente deve inviare richieste chiare, lecite e pertinenti, evitare contenuti offensivi o ingannevoli e usare la chat in modo corretto.",
      "Il cliente è responsabile delle informazioni fornite al professionista e delle decisioni prese sulla base dei profili, dei messaggi, dei preventivi e delle recensioni consultate.",
      "Le recensioni devono descrivere esperienze reali, essere rispettose e non contenere dati sensibili, informazioni false, contenuti discriminatori o elementi non pertinenti al servizio ricevuto.",
    ],
  },
  {
    title: "5. Obblighi dei professionisti",
    content: [
      "Il professionista deve inserire dati veritieri su identità, professione, competenze, località, disponibilità e informazioni di contatto.",
      "Il professionista è responsabile dei contenuti pubblicati, dei preventivi inviati, delle risposte ai clienti e dell’esecuzione delle attività concordate al di fuori del portale.",
      "Il professionista non deve usare la piattaforma per comunicazioni ingannevoli, promesse non verificabili, spam, acquisizione abusiva di dati o attività non conformi alla normativa applicabile.",
    ],
  },
  {
    title: "6. Ricerca, visibilità e abbonamento professionista",
    content: [
      "La visibilità dei professionisti nei risultati di ricerca dipende dalle regole tecniche e commerciali del servizio, inclusi stato dell’account, completezza del profilo, sospensioni e stato dell’abbonamento.",
      "I professionisti con abbonamento attivo tramite Stripe o con visibilità forzata da un amministratore possono risultare visibili secondo le regole implementate. Account scaduti, sospesi, bannati o non conformi possono essere esclusi dalla ricerca.",
      "Il gestore può aggiornare criteri di ordinamento, filtri e regole di visibilità per migliorare qualità, sicurezza e affidabilità del servizio.",
    ],
  },
  {
    title: "7. Pagamenti, rinnovi e cancellazione abbonamento",
    content: [
      "L’abbonamento professionista è gestito tramite Stripe. Il checkout, i metodi di pagamento, il portale di gestione, i rinnovi e gli stati di pagamento sono elaborati dall’infrastruttura Stripe.",
      "Il professionista deve verificare importi, durata e condizioni mostrate in checkout prima di confermare il pagamento. L’attivazione o disattivazione della visibilità dipende dallo stato comunicato da Stripe al portale.",
      "La cancellazione dell’abbonamento deve essere gestita attraverso il portale o il flusso Stripe previsto. La perdita, scadenza o sospensione dell’abbonamento può limitare la visibilità del profilo e alcune funzionalità lato cliente.",
    ],
  },
  {
    title: "8. Messaggi, allegati e preventivi",
    content: [
      "Le conversazioni consentono lo scambio di messaggi, allegati e preventivi tra partecipanti autorizzati. Gli utenti devono caricare soltanto file pertinenti, leciti e privi di contenuti dannosi.",
      "I preventivi inviati tramite chat costituiscono comunicazioni tra cliente e professionista. La piattaforma conserva il relativo stato operativo, come inviato, accettato o rifiutato, per gestire la conversazione e le notifiche.",
    ],
  },
  {
    title: "9. Post, commenti, recensioni e contenuti",
    content: [
      "Gli utenti sono responsabili dei contenuti pubblicati, inclusi post, commenti, recensioni, risposte e allegati. Non sono ammessi contenuti illeciti, offensivi, discriminatori, diffamatori, fraudolenti, promozionali non autorizzati o non pertinenti.",
      "Il gestore può rimuovere contenuti, oscurare informazioni, limitare funzionalità o sospendere account quando necessario per sicurezza, moderazione, rispetto dei Termini o tutela degli utenti.",
      "Le recensioni devono provenire da esperienze reali e non devono essere manipolate, duplicate, comprate o usate per danneggiare indebitamente un professionista.",
    ],
  },
  {
    title: "10. Assistenza e segnalazioni",
    content: [
      "Gli utenti registrati possono utilizzare il Centro Assistenza disponibile nella propria area riservata. I visitatori possono inviare richieste tramite la pagina Contattaci.",
      "Le richieste di assistenza vengono gestite attraverso il sistema ticket del portale. Il gestore può usare le informazioni ricevute per rispondere alla segnalazione, verificare problemi tecnici e migliorare il servizio.",
    ],
  },
  {
    title: "11. Uso corretto e divieti",
    content: [
      "È vietato usare il portale per attività illecite, accessi non autorizzati, scraping aggressivo, tentativi di eludere i controlli di sicurezza, caricamento di malware, spam, raccolta impropria di dati o utilizzi incompatibili con la finalità del servizio.",
      "È vietato creare account falsi, impersonare terzi, pubblicare informazioni ingannevoli o usare la piattaforma per contattare utenti in modo abusivo.",
    ],
  },
  {
    title: "12. Disponibilità del servizio",
    content: [
      "Il gestore si impegna a mantenere il portale funzionante e sicuro, ma il servizio può subire interruzioni, rallentamenti o limitazioni dovute a manutenzione, aggiornamenti, fornitori tecnici, problemi di rete o eventi non controllabili.",
      "Funzionalità come autenticazione, database, storage, email, realtime e pagamenti dipendono anche da fornitori tecnici esterni utilizzati dal progetto.",
    ],
  },
  {
    title: "13. Proprietà intellettuale",
    content: [
      "Marchi, testi, interfacce, struttura grafica, componenti software e contenuti del portale appartengono ai rispettivi titolari e non possono essere copiati, riutilizzati o distribuiti senza autorizzazione.",
      "I contenuti caricati dagli utenti restano nella responsabilità di chi li pubblica. L’utente concede al portale il diritto tecnico di conservarli, mostrarli e trasmetterli nella misura necessaria a erogare le funzionalità richieste.",
    ],
  },
  {
    title: "14. Limitazione di responsabilità",
    content: [
      "Il gestore non è responsabile della qualità, esecuzione, puntualità, idoneità o risultato delle prestazioni professionali concordate tra cliente e professionista.",
      "Il portale non garantisce che ogni informazione inserita dagli utenti sia sempre completa, aggiornata o priva di errori, pur potendo adottare controlli, verifiche e misure di moderazione.",
      "Resta ferma la responsabilità diretta degli utenti per dichiarazioni, contenuti, file, comunicazioni, preventivi e accordi conclusi tramite o a seguito dell’uso della piattaforma.",
    ],
  },
  {
    title: "15. Modifiche ai Termini",
    content: [
      "I Termini possono essere aggiornati per riflettere evoluzioni del servizio, nuove funzionalità, esigenze di sicurezza o adeguamenti normativi. La versione pubblicata sul sito è quella applicabile al momento dell’utilizzo.",
    ],
  },
  {
    title: "16. Contatti",
    content: [
      "Per assistenza, segnalazioni o richieste relative ai presenti Termini è possibile scrivere a admin@iltecnicodifiducia.it.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Termini"
      title="Termini di servizio"
      description="Condizioni di utilizzo del portale per clienti, professionisti e visitatori."
    >
      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-5">
          {TERMS_SECTIONS.map((section) => (
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
