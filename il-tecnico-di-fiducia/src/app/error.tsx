"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error-boundary]", {
      name: error.name,
      message: error.message,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-on-surface">
      <section className="w-full max-w-xl rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_8px_30px_rgba(8,43,95,0.10)] sm:p-10">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-2xl text-on-error-container"
          aria-hidden="true"
        >
          !
        </div>

        <h1 className="mt-6 font-headline-md text-[28px] leading-tight text-primary sm:text-[34px]">
          Si è verificato un problema
        </h1>

        <p className="mx-auto mt-3 max-w-md text-on-surface-variant">
          Non siamo riusciti a completare questa operazione. Puoi riprovare
          oppure tornare alla pagina iniziale.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-label-md text-on-primary transition-opacity hover:opacity-90"
          >
            Riprova
          </button>

          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant px-6 font-label-md text-primary transition-colors hover:bg-surface-container-low"
          >
            Torna alla home
          </Link>
        </div>
      </section>
    </main>
  );
}
