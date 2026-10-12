import { ContactForm } from "@/components/public-pages/contact-form";
import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

const steps = [
  {
    number: "01",
    title: "Scrivi la tua richiesta",
    description: "Raccontaci brevemente di cosa hai bisogno.",
  },
  {
    number: "02",
    title: "Ricevi la risposta via email",
    description: "Il nostro team prende in carico il messaggio e ti risponde.",
  },
  {
    number: "03",
    title: "Continua la conversazione",
    description: "Puoi continuare a rispondere senza dover creare un account.",
  },
];

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Contattaci"
      title="Hai bisogno di aiuto? Scrivici."
      description="Hai una domanda, una segnalazione o bisogno di assistenza? Inviaci un messaggio: chiunque può contattarci, anche senza creare un account."
    >
      <Container className="grid gap-6 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:py-10">
        <aside className="rounded-[28px] border border-outline-variant/30 bg-surface-container-low p-5 sm:p-6 lg:p-7">
          <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
            Come funziona
          </p>

          <h2 className="mt-2 font-headline-md text-[30px] leading-tight text-primary">
            Come possiamo aiutarti?
          </h2>

          <p className="mt-3 w-full text-base leading-7 text-on-surface-variant">
            Raccontaci cosa ti serve. Puoi inviare una richiesta anche senza essere
            registrato. Riceverai gli aggiornamenti via email e potrai continuare la
            conversazione dal tuo ticket.
          </p>

          <div className="mt-6 divide-y divide-outline-variant/20">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-button text-sm text-white">
                  {step.number}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-label-md text-base font-semibold text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 border-t border-outline-variant/20 pt-5 text-sm leading-6 text-on-surface-variant">
            Hai già un account? Puoi anche usare il Centro Assistenza dalla tua area
            riservata per avere tutte le richieste a portata di mano.
          </p>
        </aside>

        <ContactForm />
      </Container>
    </PublicPageShell>
  );
}
