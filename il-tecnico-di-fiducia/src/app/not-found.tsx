import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-on-surface">
      <section className="w-full max-w-xl rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_8px_30px_rgba(8,43,95,0.10)] sm:p-10">
        <p className="font-label-md text-sm uppercase tracking-[0.18em] text-primary">
          Errore 404
        </p>

        <h1 className="mt-3 font-headline-md text-[30px] leading-tight text-primary sm:text-[38px]">
          Pagina non trovata
        </h1>

        <p className="mx-auto mt-4 max-w-md text-on-surface-variant">
          La pagina che stai cercando non esiste, è stata spostata oppure non è
          più disponibile.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-label-md text-on-primary transition-opacity hover:opacity-90"
          >
            Torna alla home
          </Link>

          <Link
            href="/cerca"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant px-6 font-label-md text-primary transition-colors hover:bg-surface-container-low"
          >
            Cerca un professionista
          </Link>
        </div>
      </section>
    </main>
  );
}
