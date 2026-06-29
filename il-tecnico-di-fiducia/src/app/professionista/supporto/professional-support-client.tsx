"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type SupportTicket = {
  id: string;
  author_id: string;
  subject: string;
  body: string;
  status: "open" | "closed" | string;
  created_at: string;
  updated_at: string;
};

type SupportTicketsResponse = {
  page: number;
  page_size: number;
  total: number;
  tickets: SupportTicket[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusCopy(status: string) {
  if (status === "closed") {
    return {
      label: "Risolto",
      className: "bg-surface-container-high text-on-surface-variant",
    };
  }

  if (status === "waiting") {
    return {
      label: "In attesa",
      className: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    };
  }

  return {
    label: "Aperto",
    className: "bg-primary-fixed text-on-primary-fixed-variant",
  };
}

export default function ProfessionalSupportClient() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchJson<SupportTicketsResponse>("/api/support-tickets?page_size=20", {
      method: "GET",
    })
      .then((response) => {
        if (!mounted) return;
        setTickets(response.tickets ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Impossibile caricare i ticket.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanSubject = subject.replace(/\s+/g, " ").trim();
    const cleanBody = body.replace(/\s+/g, " ").trim();
    if (!cleanSubject || !cleanBody) {
      setError("Oggetto e descrizione sono obbligatori.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchJson<{ ticket: SupportTicket }>("/api/support-tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: cleanSubject,
          body: cleanBody,
        }),
      });
      setTickets((current) => [response.ticket, ...current]);
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare il ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8">
      <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
          Supporto
        </div>
        <h1 className="mt-2 font-headline-md text-headline-md text-primary">
          Apri un ticket
        </h1>
        <p className="mt-3 text-on-surface-variant">
          Usa questo spazio per richieste reali su profilo, messaggi, richieste o
          abbonamento.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={createTicket}>
          <div>
            <label className="font-label-md text-primary" htmlFor="support-subject">
              Oggetto
            </label>
            <input
              id="support-subject"
              className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              placeholder="Es. Problema con messaggi"
            />
          </div>
          <div>
            <label className="font-label-md text-primary" htmlFor="support-body">
              Descrizione
            </label>
            <textarea
              id="support-body"
              className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              placeholder="Descrivi il problema o la richiesta..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:opacity-60"
          >
            {submitting ? "Invio in corso…" : "Invia ticket"}
          </button>
        </form>
      </section>

      <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
              Ticket
            </span>
            <h2 className="font-headline-md text-headline-md text-primary">
              Le tue richieste
            </h2>
          </div>
          {loading ? (
            <span className="text-sm text-on-surface-variant">Caricamento…</span>
          ) : null}
        </div>

        {!loading && tickets.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-outline-variant p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined">support_agent</span>
            </div>
            <h3 className="mt-4 font-headline-sm text-[22px] text-primary">
              Nessun ticket aperto
            </h3>
            <p className="mx-auto mt-2 max-w-[520px] text-on-surface-variant">
              Quando invii una richiesta di supporto, la vedrai qui con il suo stato.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const copy = statusCopy(ticket.status);
              return (
                <article
                  key={ticket.id}
                  className="rounded-[24px] border border-outline-variant/30 bg-surface-container-low p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-label-md text-primary">{ticket.subject}</h3>
                      <p className="mt-1 line-clamp-3 text-sm text-on-surface-variant">
                        {ticket.body}
                      </p>
                      <p className="mt-3 text-xs text-outline">
                        Creato il {formatDate(ticket.created_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ${copy.className}`}
                    >
                      {copy.label}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
