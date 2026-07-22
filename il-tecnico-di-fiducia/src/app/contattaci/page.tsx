import { ContactForm } from "@/components/public-pages/contact-form";
import { PublicPageShell } from "@/components/public-pages/public-page-shell";
import { Container } from "@/components/site/container";

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Contattaci"
      title="Parla con il team di Il Tecnico di Fiducia"
      description="Hai una domanda, una segnalazione o bisogno di assistenza prima di registrarti? Scrivici: la richiesta verrà gestita dal nostro centro supporto."
    >
      <Container className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <aside className="rounded-[28px] border border-outline-variant/30 bg-surface-container-low p-6 sm:p-8">
          <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
            Supporto pubblico
          </p>
          <h2 className="mt-3 font-headline-md text-[30px] leading-tight text-primary">
            Una richiesta, un ticket reale.
          </h2>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Il form pubblico crea una segnalazione nel sistema ticket già usato dal
            Centro Assistenza. Non è richiesta la registrazione e i dati vengono usati
            solo per rispondere alla richiesta.
          </p>
          <div className="mt-6 rounded-2xl bg-white p-4 text-sm leading-6 text-on-surface-variant">
            Se hai già un account professionista, puoi usare anche l’area Supporto
            interna per seguire lo storico dei tuoi ticket.
          </div>
        </aside>
        <ContactForm />
      </Container>
    </PublicPageShell>
  );
}
