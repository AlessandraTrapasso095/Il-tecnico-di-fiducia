import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

const FAQS = [
  {
    question: "Cos’è Il Tecnico di Fiducia?",
    answer:
      "È una piattaforma che mette in contatto clienti e professionisti verificati, con profili consultabili, richieste tracciate, messaggi e strumenti pensati per scegliere con maggiore trasparenza.",
  },
  {
    question: "Come trovo un professionista?",
    answer:
      "Puoi cercare per categoria, professione, località o disponibilità. I risultati mostrano solo profili realmente presenti sulla piattaforma e visibili secondo le regole attive.",
  },
  {
    question: "Come mi registro?",
    answer:
      "Puoi creare un account come cliente o come professionista dalla pagina di registrazione. Dopo la conferma email accederai all’area riservata corretta.",
  },
  {
    question: "Come funziona l’abbonamento professionista?",
    answer:
      "I professionisti usano l’abbonamento per rendere visibile il profilo ai clienti e accedere agli strumenti dell’area professionista. Il pagamento viene gestito tramite Stripe.",
  },
  {
    question: "Come posso lasciare una recensione?",
    answer:
      "Le recensioni possono essere lasciate dai clienti secondo le regole previste dalla piattaforma, ad esempio dopo una richiesta accettata o un incarico valido.",
  },
  {
    question: "I pagamenti sono sicuri?",
    answer:
      "Sì. I pagamenti degli abbonamenti sono gestiti tramite Stripe: la piattaforma non salva i dati completi delle carte.",
  },
  {
    question: "Come posso ricevere assistenza?",
    answer:
      "Gli utenti registrati possono usare il Centro Assistenza dalla propria area. I visitatori possono scrivere dalla pagina Contattaci.",
  },
];

export default function FaqPage() {
  return (
    <PublicPageShell
      eyebrow="FAQ"
      title="Domande frequenti"
      description="Le risposte principali per clienti, professionisti e visitatori. I contenuti sono organizzati per essere aggiornati facilmente nel tempo."
    >
      <Container className="py-12 lg:py-16">
        <div className="grid gap-4">
          {FAQS.map((faq) => (
            <article
              key={faq.question}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.06)] sm:p-6"
            >
              <h2 className="font-headline-sm text-[22px] text-primary">{faq.question}</h2>
              <p className="mt-3 leading-7 text-on-surface-variant">{faq.answer}</p>
            </article>
          ))}
        </div>
      </Container>
    </PublicPageShell>
  );
}
