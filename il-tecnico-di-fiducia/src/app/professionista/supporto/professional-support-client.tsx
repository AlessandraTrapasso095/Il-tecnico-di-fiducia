"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type TicketStatus = "open" | "waiting" | "closed";
type SenderRole = "customer" | "professional" | "admin";

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: SenderRole;
  body: string;
  created_at: string;
};

type SupportTicket = {
  id: string;
  author_id: string;
  subject: string;
  body: string;
  status: TicketStatus | string;
  created_at: string;
  updated_at: string;
  last_message?: SupportMessage | null;
};

type SupportTicketsResponse = {
  page: number;
  page_size: number;
  total: number;
  tickets: SupportTicket[];
};

type SupportMessagesResponse = {
  messages: SupportMessage[];
};

type SupportMessageCreateResponse = {
  message: SupportMessage;
  ticket: SupportTicket;
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

function initialSelectedTicketId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ticket");
}

export default function ProfessionalSupportClient() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets],
  );

  async function loadTickets(preferredTicketId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<SupportTicketsResponse>(
        "/api/support-tickets?page_size=20",
        { method: "GET" },
      );
      const nextTickets = response.tickets ?? [];
      const preferred = preferredTicketId ?? initialSelectedTicketId();

      setTickets(nextTickets);
      setSelectedId((current) => {
        if (current && nextTickets.some((ticket) => ticket.id === current)) return current;
        if (preferred && nextTickets.some((ticket) => ticket.id === preferred)) {
          return preferred;
        }
        return nextTickets[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i ticket.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadMessages(ticketId: string) {
      setMessagesLoading(true);
      setError(null);
      try {
        const response = await fetchJson<SupportMessagesResponse>(
          `/api/support-tickets/${ticketId}/messages`,
          { method: "GET" },
        );
        if (!mounted) return;
        setMessages(response.messages ?? []);
      } catch (err) {
        if (!mounted) return;
        setMessages([]);
        setError(err instanceof Error ? err.message : "Impossibile caricare i messaggi.");
      } finally {
        if (mounted) setMessagesLoading(false);
      }
    }

    const handle = window.setTimeout(() => {
      setReplyBody("");
      setSuccess(null);
      if (selectedTicket?.id) {
        void loadMessages(selectedTicket.id);
      } else {
        setMessages([]);
      }
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [selectedTicket?.id]);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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
      setSelectedId(response.ticket.id);
      setSubject("");
      setBody("");
      setMessages([]);
      setSuccess("Ticket inviato correttamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare il ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket) return;

    const cleanReply = replyBody.replace(/\s+/g, " ").trim();
    if (!cleanReply) {
      setError("Scrivi una risposta prima di inviare.");
      return;
    }

    setReplying(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchJson<SupportMessageCreateResponse>(
        `/api/support-tickets/${selectedTicket.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body: cleanReply }),
        },
      );

      setMessages((current) => [...current, response.message]);
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === response.ticket.id
            ? { ...ticket, ...response.ticket, last_message: response.message }
            : ticket,
        ),
      );
      setReplyBody("");
      setSuccess("Risposta inviata all'assistenza.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile inviare la risposta.");
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-8 sm:px-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:px-8">
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

      <section className="grid min-h-[760px] overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-outline-variant/30 bg-surface-container-lowest lg:border-b-0 lg:border-r">
          <div className="border-b border-outline-variant/30 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
                  Ticket
                </span>
                <h2 className="font-headline-sm text-[26px] text-primary">
                  Le tue richieste
                </h2>
              </div>
              {loading ? (
                <span className="text-sm text-on-surface-variant">Caricamento…</span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
            {!loading && tickets.length === 0 ? (
              <div className="rounded-[24px] border-2 border-dashed border-outline-variant p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined">support_agent</span>
                </div>
                <h3 className="mt-4 font-headline-sm text-[21px] text-primary">
                  Nessun ticket aperto
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Quando invii una richiesta di supporto, la vedrai qui con il suo stato.
                </p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const copy = statusCopy(ticket.status);
                const isSelected = selectedTicket?.id === ticket.id;
                const preview = ticket.last_message?.body ?? ticket.body;
                const hasAdminReply = ticket.last_message?.sender_role === "admin";

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={[
                      "w-full rounded-[22px] border p-4 text-left transition",
                      isSelected
                        ? "border-primary bg-primary-fixed shadow-sm"
                        : "border-outline-variant/30 bg-surface-container-low hover:bg-surface-container",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 font-label-md text-primary">
                        {ticket.subject}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${copy.className}`}
                      >
                        {copy.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                      {preview}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-outline">
                      <span>Aperto {formatDate(ticket.created_at)}</span>
                      <span>Agg. {formatDate(ticket.updated_at)}</span>
                    </div>
                    {hasAdminReply && ticket.status !== "closed" ? (
                      <span className="mt-3 inline-flex rounded-full bg-[#FF8500]/10 px-3 py-1 text-xs font-bold text-on-tertiary-container">
                        Risposta admin
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex min-h-[760px] flex-col bg-surface-bright">
          {selectedTicket ? (
            <>
              <header className="border-b border-outline-variant/30 bg-surface-container-lowest/90 p-5 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
                      Dettaglio ticket
                    </span>
                    <h2 className="mt-1 font-headline-sm text-[30px] leading-tight text-primary">
                      {selectedTicket.subject}
                    </h2>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Aperto {formatDate(selectedTicket.created_at)} · Ultimo aggiornamento{" "}
                      {formatDate(selectedTicket.updated_at)}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${statusCopy(
                      selectedTicket.status,
                    ).className}`}
                  >
                    {statusCopy(selectedTicket.status).label}
                  </span>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {error ? (
                  <div className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    {success}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary p-4 text-white shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                      Tu · richiesta iniziale
                    </p>
                    <p className="leading-7">{selectedTicket.body}</p>
                    <p className="mt-2 text-xs opacity-60">
                      {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                </div>

                {messagesLoading ? (
                  <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 text-center text-on-surface-variant">
                    Caricamento storico…
                  </div>
                ) : null}

                {!messagesLoading &&
                  messages.map((supportMessage) => {
                    const isAdmin = supportMessage.sender_role === "admin";

                    return (
                      <div
                        key={supportMessage.id}
                        className={["flex", isAdmin ? "justify-start" : "justify-end"].join(
                          " ",
                        )}
                      >
                        <div
                          className={[
                            "max-w-[82%] rounded-2xl p-4 shadow-sm",
                            isAdmin
                              ? "rounded-tl-sm border border-outline-variant/30 bg-white text-on-surface"
                              : "rounded-tr-sm bg-primary text-white",
                          ].join(" ")}
                        >
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                            {isAdmin ? "Assistenza admin" : "Tu"}
                          </p>
                          <p className="leading-7">{supportMessage.body}</p>
                          <p className="mt-2 text-xs opacity-60">
                            {formatDate(supportMessage.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <footer className="border-t border-outline-variant/30 bg-surface-container-lowest p-5">
                {selectedTicket.status === "closed" ? (
                  <div className="rounded-2xl bg-surface-container-low p-4 text-center text-on-surface-variant">
                    Questo ticket è stato risolto. Apri una nuova richiesta se hai bisogno di
                    ulteriore supporto.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="font-label-md text-primary" htmlFor="support-reply">
                      Scrivi una risposta
                    </label>
                    <textarea
                      id="support-reply"
                      className="min-h-28 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Scrivi una risposta per l'assistenza..."
                      maxLength={2000}
                      disabled={replying}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:opacity-60"
                        onClick={() => void sendReply()}
                        disabled={replying || !replyBody.trim()}
                      >
                        {replying ? "Invio in corso…" : "Invia risposta"}
                      </button>
                    </div>
                  </div>
                )}
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined">forum</span>
                </div>
                <h3 className="mt-4 font-headline-sm text-[24px] text-primary">
                  Seleziona una richiesta
                </h3>
                <p className="mt-2 max-w-[420px] text-on-surface-variant">
                  Apri un ticket dalla lista per vedere storico e risposte dell’assistenza.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
