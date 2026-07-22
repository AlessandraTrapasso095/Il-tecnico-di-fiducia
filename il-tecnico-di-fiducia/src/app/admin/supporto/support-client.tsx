"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { fetchJson } from "@/lib/api/fetch-json";

type TicketStatus = "all" | "open" | "waiting" | "closed";
type UserRole = "customer" | "professional" | "admin";
type SubscriptionStatus =
  | "none"
  | "stripe_active"
  | "stripe_canceled"
  | "suspended"
  | "admin_forced_active";

type AdminUserSummary = {
  id: string;
  role: UserRole;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
  activity: { last_seen_at: string | null } | null;
  subscription: {
    professional_id: string;
    status: SubscriptionStatus;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
    updated_at: string;
  } | null;
  professional_directory: {
    id: string;
    headline: string | null;
    specializations: string[] | null;
    available_remote: boolean | null;
    available_travel: boolean | null;
  } | null;
};

type SupportTicket = {
  id: string;
  author_id: string;
  author: AdminUserSummary | null;
  subject: string;
  body: string;
  status: "open" | "waiting" | "closed";
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: UserRole;
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

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

const roleLabels: Record<UserRole, string> = {
  customer: "Cliente",
  professional: "Professionista",
  admin: "Admin",
};

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  none: "Non abbonato",
  stripe_active: "Stripe attivo",
  stripe_canceled: "Annullato",
  suspended: "Sospeso",
  admin_forced_active: "Forzato admin",
};

function fullName(user: Pick<AdminUserSummary, "first_name" | "last_name" | "email"> | null) {
  if (!user) return "Utente";
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email;
}

function initials(user: Pick<AdminUserSummary, "first_name" | "last_name" | "email"> | null) {
  const name = fullName(user);
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non indicata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function statusLabel(status: SupportTicket["status"]) {
  if (status === "waiting") return "In attesa";
  if (status === "closed") return "Risolto";
  return "Aperto";
}

function statusTone(status: SupportTicket["status"]) {
  if (status === "waiting") return "bg-primary-fixed text-on-primary-fixed-variant";
  if (status === "closed") return "bg-surface-container-high text-on-surface-variant";
  return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
}

function subscriptionDot(status: SubscriptionStatus | undefined) {
  if (status === "stripe_active") return "bg-emerald-500";
  if (status === "admin_forced_active") return "bg-orange-500";
  if (status === "suspended" || status === "stripe_canceled") return "bg-yellow-400";
  return "bg-red-500";
}

function Avatar({ user, size = "md" }: { user: AdminUserSummary | null; size?: "sm" | "md" }) {
  return (
    <ProfileAvatar
      person={user}
      alt={fullName(user)}
      size={size === "sm" ? "sm" : "lg"}
      fallback={initials(user)}
      className="border-2 border-primary-fixed bg-primary-fixed text-primary"
    />
  );
}

function ConfirmModal({
  action,
  busy,
  onClose,
}: {
  action: ConfirmAction;
  busy: boolean;
  onClose: () => void;
}) {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-inverse-surface/55 p-3 backdrop-blur-sm sm:p-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[24px] bg-surface-container-lowest p-4 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline-sm text-[26px] text-primary">{action.title}</h3>
            <p className="mt-2 leading-7 text-on-surface-variant">{action.body}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-full border-2 border-primary px-5 py-3 font-button text-primary transition hover:bg-primary-fixed"
            onClick={onClose}
            disabled={busy}
          >
            Annulla
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full bg-error px-5 py-3 font-button text-white transition hover:opacity-90 disabled:opacity-60"
            onClick={() => void action.onConfirm()}
            disabled={busy}
          >
            {action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailsModal({
  user,
  busy,
  onClose,
  onPatchUser,
  onUserAction,
  onDeleteUser,
  onSubscription,
}: {
  user: AdminUserSummary | null;
  busy: boolean;
  onClose: () => void;
  onPatchUser: (user: AdminUserSummary, body: Record<string, unknown>, success: string) => void;
  onUserAction: (user: AdminUserSummary, endpoint: string, success: string) => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onSubscription: (
    user: AdminUserSummary,
    status: "none" | "admin_forced_active" | "suspended",
    currentPeriodEnd?: string | null,
  ) => void;
}) {
  if (!user) return null;

  const isSuspended =
    Boolean(user.is_banned) ||
    (user.suspended_until ? new Date(user.suspended_until) > new Date() : false);
  const subscriptionStatus = user.subscription?.status ?? "none";
  const subscriptionActive =
    subscriptionStatus === "stripe_active" || subscriptionStatus === "admin_forced_active";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/45 p-3 backdrop-blur-sm sm:p-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] bg-surface-container-lowest p-4 shadow-2xl sm:rounded-[30px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar user={user} />
            <div className="min-w-0">
              <h3 className="truncate font-headline-sm text-[28px] text-primary">
                {fullName(user)}
              </h3>
              <p className="truncate text-sm text-on-surface-variant">
                {user.email} · {roleLabels[user.role]}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            onClick={onClose}
            aria-label="Chiudi dettaglio utente"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] bg-surface-container-low p-4">
            <p className="font-label-md text-primary">Dati utente</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Provincia</dt>
                <dd className="font-semibold text-primary">{user.province_code ?? "Non indicata"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Telefono</dt>
                <dd className="font-semibold text-primary">{user.phone ?? "Non indicato"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Registrazione</dt>
                <dd className="text-right font-semibold text-primary">{formatDate(user.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Stato account</dt>
                <dd className="font-semibold text-primary">
                  {isSuspended ? "Sospeso" : "Attivo"}
                </dd>
              </div>
            </dl>
          </div>

          {user.role === "professional" ? (
            <div className="rounded-[22px] bg-surface-container-low p-4">
              <p className="font-label-md text-primary">Profilo professionista</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Professione</dt>
                  <dd className="text-right font-semibold text-primary">
                    {user.professional_directory?.headline ?? "Non indicata"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Sottocategorie</dt>
                  <dd className="text-right font-semibold text-primary">
                    {user.professional_directory?.specializations?.join(", ") || "Non indicate"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Abbonamento</dt>
                  <dd className="flex items-center gap-2 font-semibold text-primary">
                    <span
                      className={`h-3 w-3 rounded-sm ${subscriptionDot(subscriptionStatus)}`}
                    />
                    {subscriptionLabels[subscriptionStatus]}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Scadenza/rinnovo</dt>
                  <dd className="text-right font-semibold text-primary">
                    {formatDate(user.subscription?.current_period_end)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isSuspended ? (
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-4 py-2 font-button text-white disabled:opacity-60"
              onClick={() =>
                onPatchUser(
                  user,
                  { is_banned: false, suspended_until: null },
                  "Account riattivato.",
                )
              }
              disabled={busy}
            >
              Riattiva account
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rounded-full bg-yellow-400 px-4 py-2 font-button text-primary disabled:opacity-60"
                onClick={() =>
                  onPatchUser(
                    user,
                    { is_banned: true, suspended_until: addDays(7) },
                    "Account sospeso per 1 settimana.",
                  )
                }
                disabled={busy}
              >
                Sospendi 1 settimana
              </button>
              <button
                type="button"
                className="rounded-full bg-yellow-400 px-4 py-2 font-button text-primary disabled:opacity-60"
                onClick={() =>
                  onPatchUser(
                    user,
                    { is_banned: true, suspended_until: addMonths(1) },
                    "Account sospeso per 1 mese.",
                  )
                }
                disabled={busy}
              >
                Sospendi 1 mese
              </button>
              <button
                type="button"
                className="rounded-full bg-yellow-400 px-4 py-2 font-button text-primary disabled:opacity-60"
                onClick={() =>
                  onPatchUser(
                    user,
                    { is_banned: true, suspended_until: null },
                    "Account sospeso a tempo indeterminato.",
                  )
                }
                disabled={busy}
              >
                Sospendi sempre
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-full border border-primary px-4 py-2 font-button text-primary disabled:opacity-60"
            onClick={() =>
              onUserAction(
                user,
                "send-password-reset",
                "Email reset password inviata.",
              )
            }
            disabled={busy}
          >
            Invia reset password
          </button>
          <button
            type="button"
            className="rounded-full border border-primary px-4 py-2 font-button text-primary disabled:opacity-60"
            onClick={() =>
              onUserAction(
                user,
                "resend-confirmation",
                "Email conferma inviata.",
              )
            }
            disabled={busy}
          >
            Invia conferma email
          </button>
          {user.role === "professional" ? (
            subscriptionActive ? (
              <button
                type="button"
                className="rounded-full bg-surface-container-high px-4 py-2 font-button text-primary disabled:opacity-60"
                onClick={() => onSubscription(user, "none", null)}
                disabled={busy}
              >
                Annulla abbonamento
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-full bg-[#FF8500] px-4 py-2 font-button text-white disabled:opacity-60"
                  onClick={() => onSubscription(user, "admin_forced_active", addDays(7))}
                  disabled={busy}
                >
                  Forza 1 settimana
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#FF8500] px-4 py-2 font-button text-white disabled:opacity-60"
                  onClick={() => onSubscription(user, "admin_forced_active", addMonths(1))}
                  disabled={busy}
                >
                  Forza 1 mese
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#FF8500] px-4 py-2 font-button text-white disabled:opacity-60"
                  onClick={() => onSubscription(user, "admin_forced_active", null)}
                  disabled={busy}
                >
                  Forza illimitato
                </button>
              </>
            )
          ) : null}
          <button
            type="button"
            className="rounded-full bg-error px-4 py-2 font-button text-white disabled:opacity-60"
            onClick={() => onDeleteUser(user)}
            disabled={busy}
          >
            Elimina definitivamente
          </button>
        </div>
      </div>
    </div>
  );
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
  const [authorModalUser, setAuthorModalUser] = useState<AdminUserSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

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
      setAuthorModalUser((current) => {
        if (!current) return null;
        return (
          nextTickets.find((ticket) => ticket.author_id === current.id)?.author ?? current
        );
      });
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

  async function sendReply(nextStatus: "waiting" | "closed") {
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
        body: JSON.stringify({ body: cleanReply, next_status: nextStatus }),
      });

      setReplyBody("");
      setMessage(
        nextStatus === "closed"
          ? "Risposta inviata e ticket segnato come risolto."
          : "Risposta inviata. Il ticket resta in attesa.",
      );
      await loadTickets();
      await loadMessages(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio risposta non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveTicket() {
    if (!selected) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/support-tickets/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setMessage("Ticket segnato come risolto.");
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento ticket non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    user: AdminUserSummary,
    body: Record<string, unknown>,
    success: string,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage(success);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Azione utente non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function userAction(user: AdminUserSummary, endpoint: string, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/users/${user.id}/${endpoint}`, { method: "POST" });
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Azione utente non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  function deleteUser(user: AdminUserSummary) {
    setConfirmAction({
      title: "Eliminare definitivamente l'account?",
      body: `L'account di ${fullName(user)} verrà rimosso anche da Supabase Auth. Questa azione non può essere annullata.`,
      confirmLabel: "Elimina account",
      onConfirm: async () => {
        setBusy(true);
        setError(null);
        try {
          await fetchJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
          setConfirmAction(null);
          setAuthorModalUser(null);
          setMessage("Account eliminato definitivamente.");
          await loadTickets();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Eliminazione non riuscita.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function updateSubscription(
    user: AdminUserSummary,
    nextStatus: "none" | "admin_forced_active" | "suspended",
    currentPeriodEnd?: string | null,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/professionals/${user.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          current_period_end: currentPeriodEnd ?? null,
        }),
      });
      setMessage("Abbonamento aggiornato.");
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento abbonamento non riuscito.");
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
            ["waiting", "In attesa"],
            ["closed", "Risolti"],
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

      <div className="grid min-h-[620px] overflow-hidden rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:rounded-[28px] lg:min-h-[680px] lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="border-b border-outline-variant/30 lg:border-b-0 lg:border-r">
          <div className="border-b border-outline-variant/30 p-4">
            <h2 className="font-headline-sm text-[24px] text-primary">Ticket</h2>
            <p className="text-sm text-on-surface-variant">
              {loading ? "Caricamento…" : `${tickets.length} risultati`}
            </p>
          </div>
          <div className="max-h-[min(680px,calc(100dvh-12rem))] overflow-y-auto">
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
                  <div className="flex items-start gap-3">
                    <Avatar user={ticket.author} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-label-md text-primary">
                            {fullName(ticket.author)}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {ticket.author?.email ?? "Email non disponibile"} ·{" "}
                            {ticket.author ? roleLabels[ticket.author.role] : "Utente"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs ${statusTone(ticket.status)}`}
                        >
                          {statusLabel(ticket.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-label-md text-primary">
                        {ticket.subject}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                        {ticket.body}
                      </p>
                      <p className="mt-2 text-xs text-outline">
                        Creato {formatDate(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="min-w-0 p-4 sm:p-5">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-label-md text-sm uppercase tracking-[0.14em] text-[#FF8500]">
                    Dettaglio ticket
                  </p>
                    <h2 className="mt-1 font-headline-sm text-[24px] text-primary sm:text-[30px]">
                    {selected.subject}
                  </h2>
                  <div className="mt-3 flex items-center gap-3 text-sm text-on-surface-variant">
                    <Avatar user={selected.author} size="sm" />
                    <div>
                      <button
                        type="button"
                        className="font-semibold text-primary hover:underline"
                        onClick={() => setAuthorModalUser(selected.author)}
                        disabled={!selected.author}
                      >
                        {fullName(selected.author)}
                      </button>
                      <p>
                        {selected.author?.email ?? "Email non disponibile"} · Creato:{" "}
                        {formatDate(selected.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-sm ${statusTone(selected.status)}`}
                >
                  {statusLabel(selected.status)}
                </span>
              </div>

              <div className="rounded-[24px] bg-surface-container-low p-5 leading-7 text-on-surface">
                <p className="mb-2 font-label-md text-primary">Richiesta iniziale</p>
                <p className="break-words [overflow-wrap:anywhere]">{selected.body}</p>
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
                      const isAuthor = supportMessage.sender_role !== "admin";
                      return (
                        <div
                          key={supportMessage.id}
                          className={["flex", isAuthor ? "justify-start" : "justify-end"].join(
                            " ",
                          )}
                        >
                          <div
                            className={[
                              "max-w-[88%] rounded-2xl p-4 shadow-sm sm:max-w-[78%]",
                              isAuthor
                                ? "rounded-tl-sm border border-outline-variant/30 bg-white text-on-surface"
                                : "rounded-tr-sm bg-primary text-white",
                            ].join(" ")}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                              {isAuthor ? fullName(selected.author) : "Admin"}
                            </p>
                            <p className="break-words leading-6 [overflow-wrap:anywhere]">
                              {supportMessage.body}
                            </p>
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
                      ? "Ticket risolto: non puoi inviare nuove risposte."
                      : "Scrivi la risposta da inviare all'utente..."
                  }
                  disabled={busy || selected.status === "closed"}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-primary px-5 py-3 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
                    disabled={busy || selected.status === "closed" || !replyBody.trim()}
                    onClick={() => void sendReply("waiting")}
                  >
                    Invia risposta
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-[#FF8500] px-5 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
                    disabled={busy || selected.status === "closed" || !replyBody.trim()}
                    onClick={() => void sendReply("closed")}
                  >
                    Invia risposta e chiudi
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-full border-2 border-primary px-5 py-3 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-60"
                    disabled={busy || selected.status === "closed"}
                    onClick={() => void resolveTicket()}
                  >
                    Segna come risolto
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

      <UserDetailsModal
        user={authorModalUser}
        busy={busy}
        onClose={() => setAuthorModalUser(null)}
        onPatchUser={(user, body, success) => void patchUser(user, body, success)}
        onUserAction={(user, endpoint, success) => void userAction(user, endpoint, success)}
        onDeleteUser={deleteUser}
        onSubscription={(user, nextStatus, currentPeriodEnd) =>
          void updateSubscription(user, nextStatus, currentPeriodEnd)
        }
      />
      <ConfirmModal
        action={confirmAction}
        busy={busy}
        onClose={() => {
          if (!busy) setConfirmAction(null);
        }}
      />
    </div>
  );
}
