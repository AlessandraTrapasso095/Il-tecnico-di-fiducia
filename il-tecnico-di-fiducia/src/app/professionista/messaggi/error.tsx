"use client";

import { useEffect } from "react";

export default function ProfessionalMessagesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[professionista/messaggi] segment_error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-160px)] w-full min-w-0 flex-1 items-center justify-center bg-surface-container-low px-6 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-on-error-container">
          <span className="material-symbols-outlined" aria-hidden>
            forum
          </span>
        </div>
        <h1 className="mt-5 font-headline-sm text-[28px] text-primary">
          Messaggi temporaneamente non disponibili
        </h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          L’area professionista è caricata correttamente, ma la sezione messaggi ha
          ricevuto un errore durante il render. Puoi riprovare senza perdere la
          navigazione.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-[#FF8500]/20 transition hover:bg-[#FF9A2B]"
            onClick={() => unstable_retry()}
          >
            Riprova
          </button>
          <a
            href="/professionista/messaggi"
            className="rounded-full border border-primary px-6 py-3 font-button text-primary transition hover:bg-primary-fixed"
          >
            Apri messaggi
          </a>
        </div>
      </div>
    </div>
  );
}
