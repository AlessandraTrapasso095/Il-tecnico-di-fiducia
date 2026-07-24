"use client";

import { useState } from "react";

export function ProposeTechnicianCta() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startProposalCheckout() {
    setLoading(true);
    setMessage(null);

    try {
      // TODO: collegare qui la futura route server-side Stripe per il contributo di €4,99.
      setMessage(
        "Il pagamento della proposta verrà attivato nel prossimo step. Nessun addebito è stato eseguito.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[32px] border border-outline-variant/30 bg-white p-6 shadow-[0_18px_60px_rgba(8,43,95,0.12)] sm:p-8">
      <p className="font-label-md text-sm uppercase tracking-[0.18em] text-[#FF8500]">
        Contributo valutazione
      </p>
      <h2 className="mt-3 font-headline-md text-[30px] leading-tight text-primary sm:text-[36px]">
        Vuoi proporre una nuova figura professionale?
      </h2>
      <p className="mt-4 leading-7 text-on-surface-variant">
        Il contributo di €4,99 serve a coprire l’analisi della proposta e a rendere
        l’invio consapevole. Non garantisce automaticamente l’inserimento della
        categoria e non costituisce un acquisto della professione proposta.
      </p>
      <button
        type="button"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        onClick={startProposalCheckout}
        disabled={loading}
      >
        {loading ? "Preparazione in corso…" : "Proponi una figura professionale — €4,99"}
      </button>
      {message ? (
        <div className="mt-5 rounded-2xl border border-primary-fixed bg-surface-container-low p-4 text-sm leading-6 text-primary">
          {message}
        </div>
      ) : null}
    </div>
  );
}
