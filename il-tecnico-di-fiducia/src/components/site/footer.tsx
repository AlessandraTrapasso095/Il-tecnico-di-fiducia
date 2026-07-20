import Link from "next/link";
import { Container } from "./container";

export function Footer() {
  return (
    <footer className="bg-primary text-on-primary">
      <Container className="grid grid-cols-1 gap-8 py-8 sm:grid-cols-2 sm:py-12 lg:grid-cols-4 lg:gap-10">
        <div className="space-y-4">
          <div className="font-headline-sm text-headline-sm text-on-primary">
            Il tecnico di fiducia
          </div>
          <p className="font-body-md text-body-md text-surface-container-highest/80">
            La tua piattaforma di riferimento per trovare professionisti verificati in
            Italia.
          </p>
        </div>

        <div className="space-y-3">
          <div className="font-label-md text-label-md text-on-tertiary-container uppercase tracking-wider">
            Piattaforma
          </div>
          <div className="flex flex-col gap-2">
            <Link
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="/#come-funziona"
            >
              Come funziona
            </Link>
            <Link
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="/#professioni"
            >
              Professioni
            </Link>
            <Link
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="/auth/register"
            >
              Registrati
            </Link>
          </div>
        </div>

        <div className="space-y-3" id="supporto">
          <div className="font-label-md text-label-md text-on-tertiary-container uppercase tracking-wider">
            Supporto
          </div>
          <div className="flex flex-col gap-2">
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              Centro assistenza
            </a>
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              Contattaci
            </a>
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              FAQ
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <div className="font-label-md text-label-md text-on-tertiary-container uppercase tracking-wider">
            Legale
          </div>
          <div className="flex flex-col gap-2">
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              Termini di servizio
            </a>
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              Privacy policy
            </a>
            <a
              className="text-surface-container-highest hover:text-on-primary-container transition-colors"
              href="#"
            >
              Cookie policy
            </a>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-4 py-6 text-center sm:flex-row sm:text-left">
          <div className="text-surface-container-highest/70 text-sm">
            © {new Date().getFullYear()} Il Tecnico di Fiducia. Tutti i diritti riservati.
          </div>
          <div className="flex gap-3 text-surface-container-highest/80">
            <a className="hover:text-on-tertiary-container transition-colors" href="#">
              Contatti
            </a>
            <a className="hover:text-on-tertiary-container transition-colors" href="#">
              Privacy
            </a>
          </div>
        </Container>
      </div>
    </footer>
  );
}
