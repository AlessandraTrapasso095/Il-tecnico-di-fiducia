import type { Metadata } from "next";

import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export const metadata: Metadata = {
  title: "FAQ | Il Tecnico di Fiducia",
  description:
    "Domande frequenti su ricerca professionisti, account, recensioni, pagamenti, assistenza e sicurezza.",
};

const FAQS = [
  {
    question: "Cos’è Il Tecnico di Fiducia?",
    answer:
      "È un portale che aiuta clienti e professionisti a entrare in contatto in modo ordinato, con profili, ricerca, richieste, messaggi, recensioni, preventivi e assistenza integrata.",
  },
  {
    question: "Come posso trovare un professionista?",
    answer:
      "Puoi usare la ricerca pubblica o l’area cliente per filtrare professionisti per professione, categoria, sottocategoria, provincia, località e disponibilità. I risultati mostrano dati reali presenti sulla piattaforma.",
  },
  {
    question: "Devo registrarmi per cercare?",
    answer:
      "La navigazione pubblica consente di scoprire il servizio e orientarsi. Per inviare richieste, gestire chat, preferiti e notifiche è necessario accedere con un account cliente.",
  },
  {
    question: "Come funziona il motore di ricerca?",
    answer:
      "La ricerca usa testo e filtri reali collegati ai profili professionali, come nome, cognome, professione, categoria, sottocategoria, località, provincia e disponibilità da remoto o a trasferte.",
  },
  {
    question: "Perché alcuni professionisti non compaiono nei risultati?",
    answer:
      "La visibilità dipende dalle regole attive del servizio. In generale compaiono solo professionisti con profilo valido, account non sospeso e abbonamento attivo oppure visibilità abilitata da amministratore.",
  },
  {
    question: "Come mi registro come cliente?",
    answer:
      "Dalla pagina di registrazione puoi scegliere il ruolo cliente, inserire i dati richiesti e confermare l’account tramite email. Dopo l’accesso potrai cercare professionisti e inviare richieste.",
  },
  {
    question: "Come mi registro come professionista?",
    answer:
      "Dalla registrazione puoi scegliere il ruolo professionista e completare i dati del profilo. La visibilità ai clienti dipende dallo stato dell’account e dall’abbonamento professionista.",
  },
  {
    question: "Come funziona l’abbonamento professionista?",
    answer:
      "L’abbonamento consente al professionista di rendere visibile il proprio profilo e accedere alle funzionalità previste. Checkout, pagamenti e gestione dell’abbonamento sono effettuati tramite Stripe.",
  },
  {
    question: "Posso cancellare o gestire l’abbonamento?",
    answer:
      "Il professionista può gestire l’abbonamento dalla propria area, usando il flusso Stripe previsto per aggiornare metodo di pagamento o cancellare la sottoscrizione quando disponibile.",
  },
  {
    question: "Come contatto un professionista?",
    answer:
      "Dalla scheda del professionista puoi inviare una richiesta con oggetto, messaggio ed eventuali allegati. Dopo la richiesta si apre una conversazione collegata allo stato della richiesta.",
  },
  {
    question: "Quando vedo i dati di contatto del professionista?",
    answer:
      "I dati sensibili di contatto possono essere oscurati finché non esiste una richiesta accettata o una condizione di sblocco prevista dalle regole della piattaforma.",
  },
  {
    question: "Come funzionano messaggi e allegati?",
    answer:
      "Le conversazioni permettono di inviare testo, immagini, video e documenti supportati. Gli allegati restano collegati al messaggio e sono visibili ai partecipanti autorizzati.",
  },
  {
    question: "Cosa sono i preventivi in chat?",
    answer:
      "Quando una richiesta è accettata, il professionista può inviare un preventivo nella conversazione. Il cliente può visualizzarlo e indicare se lo accetta o lo rifiuta.",
  },
  {
    question: "Come posso lasciare una recensione?",
    answer:
      "Il cliente può lasciare una recensione quando le regole della piattaforma lo consentono, ad esempio in relazione a una richiesta accettata. Le recensioni devono essere reali, pertinenti e rispettose.",
  },
  {
    question: "Il professionista può rispondere a una recensione?",
    answer:
      "Sì, il professionista può pubblicare una risposta secondo le regole previste. La risposta viene mostrata insieme alla recensione e non deve contenere contenuti offensivi o dati non pertinenti.",
  },
  {
    question: "I pagamenti sono sicuri?",
    answer:
      "Gli abbonamenti professionista sono gestiti tramite Stripe. Il portale non conserva i dati completi delle carte di pagamento e riceve solo le informazioni necessarie sullo stato della sottoscrizione.",
  },
  {
    question: "Come recupero la password?",
    answer:
      "Dalla pagina di login puoi avviare il recupero password. Il sistema invia le istruzioni all’indirizzo email associato all’account tramite il flusso di autenticazione.",
  },
  {
    question: "Come funziona l’assistenza?",
    answer:
      "Gli utenti registrati possono usare il Centro Assistenza dalla propria area. I visitatori non registrati possono inviare una richiesta dalla pagina Contattaci, che viene gestita dal sistema ticket.",
  },
  {
    question: "Come posso eliminare l’account?",
    answer:
      "L’eliminazione account è gestita dalle impostazioni dell’area riservata. Per sicurezza richiede una conferma esplicita e può essere limitata se esistono condizioni tecniche o abbonamenti attivi da gestire prima.",
  },
  {
    question: "Come vengono protetti i dati?",
    answer:
      "Il portale usa autenticazione, ruoli, policy di accesso, controlli server-side e fornitori tecnici come Supabase, Stripe e infrastruttura hosting per erogare il servizio in modo sicuro.",
  },
];

export default function FaqPage() {
  return (
    <PublicPageShell
      eyebrow="FAQ"
      title="Domande frequenti"
      description="Risposte chiare sulle funzionalità principali del portale per clienti, professionisti e visitatori."
    >
      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-4">
            {FAQS.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.06)] sm:p-6"
              >
                <h2 className="font-headline-sm text-[22px] leading-tight text-primary">
                  {faq.question}
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-on-surface-variant sm:text-base">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </PublicPageShell>
  );
}
