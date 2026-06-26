"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type TicketStatus = "all" | "open" | "closed";

type SupportTicket = {
  id: string;
  author_id: string;
  subject: string;
  body: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type TicketsResponse = {
  tickets: SupportTicket[];
  total: number;
};

type MessagesResponse = {
  messages: SupportMessage[];
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

export default function AdminSupportClient() {
  const [status, setStatus] = useState<TicketStatus>("open");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets],
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page_size: "100" });
      if (status !== "all") params.set("status", status);
      const response = await fetchJson<TicketsResponse>(
        `/api/support-tickets?${params.toString()}`,
      );
      const nextTickets = response.tickets ?? [];
      setTickets(nextTickets);
      setSelectedId((current) =>
        current && nextTickets.some((ticket) => ticket.id === current)
          ? current
          : nextTickets[0]?.id ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i ticket.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const response = await fetchJson<MessagesResponse>(
        `/api/support-tickets/${ticketId}/messages`,
      );
      setMessages(response.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i messaggi.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadTickets]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setReplyBody("");
      setMessage(null);
      setError(null);
      if (selected?.id) {
        void loadMessages(selected.id);
      } else {
        setMessages([]);
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadMessages, selected?.id]);

  async function updateTicket(nextStatus: "open" | "closed") {
    if (!selected) return;

    await fetchJson(`/api/support-tickets/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function sendReply(closeAfterReply: boolean) {
    if (!selected) return;

    const cleanReply = replyBody.trim();
    if (!cleanReply) {
      setError("Scrivi una risposta prima di inviare.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/support-tickets/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: cleanReply }),
      });

      if (closeAfterReply && selected.status !== "closed") {
        await updateTicket("closed");
      }

      setReplyBody("");
      setMessage(
        closeAfterReply
          ? "Risposta inviata e ticket chiuso."
          : "Risposta inviata. Il ticket resta aperto.",
      );
      await loadTickets();
      await loadMessages(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio risposta non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="flex flex-wrap gap-2">
          {[
            ["open", "Aperti"],
            ["closed", "Chiusi"],
            ["all", "Tutti"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={[
                "rounded-full px-5 py-2 font-button transition",
                status === value
                  ? "bg-primary text-white"
                  : "bg-surface-container-low text-primary hover:bg-primary-fixed",
              ].join(" ")}
              onClick={() => {
                setStatus(value as TicketStatus);
                setSelectedId(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div>
      ) : null}

      <div className="grid min-h-[680px] overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)] lg:grid-cols-[380px_1fr]">
        <section className="border-b border-outline-variant/30 lg:border-b-0 lg:border-r">
          <div className="border-b border-outline-variant/30 p-4">
            <h2 className="font-headline-sm text-[24px] text-primary">Ticket</h2>
            <p className="text-sm text-on-surface-variant">
              {loading ? "Caricamento…" : `${tickets.length} risultati`}
            </p>
          </div>
          <div className="max-h-[680px] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant">
                Nessun ticket reale con questo filtro.
              </div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={[
                    "block w-full border-b border-outline-variant/20 p-4 text-left transition hover:bg-surface-container-low",
                    selected?.id === ticket.id ? "bg-primary-fixed/60" : "",
                  ].join(" ")}
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 font-label-md text-primary">
                      {ticket.subject}
                    </h3>
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-xs",
                        ticket.status === "open"
                          ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                          : "bg-surface-container-high text-on-surface-variant",
                      ].join(" ")}
                    >
                      {ticket.status === "open" ? "Aperto" : "Chiuso"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                    {ticket.body}
                  </p>
                  <p className="mt-2 text-xs text-outline">{formatDate(ticket.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="p-5">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-label-md text-sm uppercase tracking-[0.14em] text-[#FF8500]">
                    Dettaglio ticket
                  </p>
                  <h2 className="mt-1 font-headline-sm text-[30px] text-primary">
                    {selected.subject}
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Autore: {selected.author_id} · Creato: {formatDate(selected.created_at)}
                  </p>
                </div>
                <span
                  className={[
                    "w-fit rounded-full px-3 py-1 text-sm",
                    selected.status === "open"
                      ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                      : "bg-surface-container-high text-on-surface-variant",
                  ].join(" ")}
                >
                  {selected.status === "open" ? "Aperto" : "Chiuso"}
                </span>
              </div>

              <div className="rounded-[24px] bg-surface-container-low p-5 leading-7 text-on-surface">
                <p className="mb-2 font-label-md text-primary">Richiesta iniziale</p>
                <p>{selected.body}</p>
              </div>

              <div className="rounded-[24px] border border-outline-variant/30 bg-surface-bright p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-headline-sm text-[22px] text-primary">
                    Storico messaggi
                  </h3>
                  <span className="text-sm text-on-surface-variant">
                    {messagesLoading ? "Caricamento…" : `${messages.length} messaggi`}
                  </span>
                </div>

                <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-outline-variant p-5 text-center text-on-surface-variant">
                      Nessuna risposta ancora registrata per questo ticket.
                    </div>
                  ) : (
                    messages.map((supportMessage) => {
                      const isAuthor = supportMessage.sender_id === selected.author_id;
                      return (
                        <div
                          key={supportMessage.id}
                          className={[
                            "flex",
                            isAuthor ? "justify-start" : "justify-end",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "max-w-[78%] rounded-2xl p-4 shadow-sm",
                              isAuthor
                                ? "rounded-tl-sm border border-outline-variant/30 bg-white text-on-surface"
                                : "rounded-tr-sm bg-primary text-white",
                            ].join(" ")}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                              {isAuthor ? "Utente" : "Admin"}
                            </p>
                            <p className="leading-6">{supportMessage.body}</p>
                            <p className="mt-2 text-xs opacity-60">
                              {formatDate(supportMessage.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-outline-variant/30 bg-white p-4">
                <label className="font-label-md text-primary" htmlFor="admin-support-reply">
                  Risposta admin
                </label>
                <textarea
                  id="admin-support-reply"
                  className="mt-3 min-h-32 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder={
                    selected.status === "closed"
                      ? "Ticket chiuso: non puoi inviare nuove risposte."
                      : "Scrivi la risposta da inviare all'utente..."
                  }
                  disabled={busy || selected.status === "closed"}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-primary px-5 py-3 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
                    disabled={busy || selected.status === "closed" || !replyBody.trim()}
                    onClick={() => void sendReply(false)}
                  >
                    Invia e attendi risposta
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[#FF8500] px-5 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
                    disabled={busy || selected.status === "closed" || !replyBody.trim()}
                    onClick={() => void sendReply(true)}
                  >
                    Invia e chiudi
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-on-surface-variant">
              Seleziona un ticket reale dalla lista.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
