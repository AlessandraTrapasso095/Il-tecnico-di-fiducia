"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmActionModal } from "@/components/posts/post-media-ui";
import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES } from "@/lib/locations/italian-provinces";

type AdminRole = "customer" | "professional" | "admin";
type SubscriptionStatus = "none" | "stripe_active" | "stripe_canceled" | "suspended" | "admin_forced_active";

type AdminUser = {
  id: string;
  role: AdminRole;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
  activity: { is_online: boolean; last_seen_at: string | null };
  subscription: {
    professional_id: string;
    status: SubscriptionStatus;
    current_period_end: string | null;
    updated_at: string | null;
  } | null;
  professional_directory: {
    headline: string | null;
    specializations: string[] | null;
    available_remote: boolean;
    available_travel: boolean;
  } | null;
  metrics:
    | {
        professionals_contacted: number;
        reviews_left: number;
      }
    | {
        customers_accepted: number;
        reviews_received: number;
        average_rating: number | null;
      }
    | null;
};

type UsersResponse = {
  users: AdminUser[];
  total: number;
};

type PendingAction =
  | { type: "delete"; user: AdminUser }
  | { type: "ban"; user: AdminUser; nextValue: boolean }
  | null;

const roleLabels: Record<AdminRole, string> = {
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

function provinceName(code: string | null) {
  if (!code) return "Non indicata";
  return ITALIAN_PROVINCES.find((province) => province.code === code)?.name ?? code;
}

function fullName(user: AdminUser) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Senza nome";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function subscriptionTone(status: SubscriptionStatus | null | undefined) {
  if (status === "stripe_active") return "bg-emerald-500";
  if (status === "admin_forced_active") return "bg-orange-500";
  if (status === "suspended" || status === "stripe_canceled") return "bg-yellow-400";
  return "bg-red-500";
}

function ActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "rounded-full px-4 py-2 font-button text-sm transition disabled:opacity-60",
        danger
          ? "bg-error-container text-error hover:bg-error/10"
          : "bg-primary-fixed text-primary hover:bg-primary-fixed-dim",
      ].join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AdminUsersClient({ role }: { role: AdminRole }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        role,
        page_size: "100",
      });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetchJson<UsersResponse>(`/api/admin/users?${params.toString()}`);
      setUsers(response.users ?? []);
      setTotal(response.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare gli utenti.");
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadUsers();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [loadUsers]);

  const expandedUser = useMemo(
    () => users.find((user) => user.id === expandedId) ?? null,
    [expandedId, users],
  );

  async function runUserPatch(user: AdminUser, body: Record<string, unknown>, success: string) {
    setBusy(user.id);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage(success);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  async function runUserAction(user: AdminUser, endpoint: string, success: string) {
    setBusy(user.id);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(endpoint, { method: "POST" });
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  async function updateSubscription(user: AdminUser, status: "none" | "admin_forced_active" | "suspended") {
    setBusy(user.id);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/professionals/${user.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Stato abbonamento aggiornato.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento abbonamento non riuscito.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setBusy(action.user.id);
    setError(null);
    setMessage(null);
    try {
      if (action.type === "delete") {
        await fetchJson(`/api/admin/users/${action.user.id}`, { method: "DELETE" });
        setMessage("Account eliminato definitivamente.");
      } else {
        await fetchJson(`/api/admin/users/${action.user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_banned: action.nextValue }),
        });
        setMessage(action.nextValue ? "Account sospeso." : "Account riattivato.");
      }
      setPendingAction(null);
      setExpandedId(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-headline-sm text-[26px] text-primary">
              {roleLabels[role]}
            </h2>
            <p className="text-on-surface-variant">
              {loading ? "Caricamento…" : `${total.toLocaleString("it-IT")} record totali`}
            </p>
          </div>
          <div className="relative w-full sm:max-w-[420px]">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              className="w-full rounded-full border border-outline-variant bg-surface-container-low px-12 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca nome o email..."
            />
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined">search_off</span>
            </div>
            <h3 className="mt-4 font-headline-sm text-[24px] text-primary">
              Nessun risultato
            </h3>
            <p className="mt-2 text-on-surface-variant">
              Non ci sono utenti reali che corrispondono ai filtri attuali.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/30">
            {users.map((user) => {
              const expanded = expandedUser?.id === user.id;
              const subscriptionStatus = user.subscription?.status ?? "none";
              return (
                <article key={user.id} className="p-4">
                  <button
                    type="button"
                    className="grid w-full gap-3 text-left md:grid-cols-[1.2fr_1.4fr_1fr_auto] md:items-center"
                    onClick={() => setExpandedId(expanded ? null : user.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={[
                          "h-3 w-3 shrink-0 rounded-full",
                          user.activity?.is_online ? "bg-emerald-500" : "bg-outline-variant",
                        ].join(" ")}
                        aria-label={user.activity?.is_online ? "Online" : "Offline"}
                      />
                      {role === "professional" ? (
                        <span
                          className={`h-4 w-4 shrink-0 rounded ${subscriptionTone(subscriptionStatus)}`}
                          title={subscriptionLabels[subscriptionStatus]}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate font-label-md text-primary">{fullName(user)}</p>
                        <p className="truncate text-sm text-on-surface-variant">{user.email}</p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm text-on-surface-variant">
                      {role === "professional" ? (
                        <>
                          <p className="truncate text-primary">
                            {user.professional_directory?.headline || "Professione non indicata"}
                          </p>
                          <p className="truncate">
                            {(user.professional_directory?.specializations ?? []).join(", ") ||
                              "Sottocategorie non indicate"}
                          </p>
                        </>
                      ) : (
                        <p>{provinceName(user.province_code)}</p>
                      )}
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      <p>{user.is_banned ? "Sospeso" : "Attivo"}</p>
                      <p>Registrato: {formatDate(user.created_at)}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary">
                      {expanded ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="mt-4 rounded-[22px] bg-surface-container-low p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Info label="ID" value={user.id} />
                        <Info label="Telefono" value={user.phone || "Non indicato"} />
                        <Info label="Provincia" value={provinceName(user.province_code)} />
                        <Info
                          label="Stato online"
                          value={
                            user.activity?.is_online
                              ? "Online"
                              : `Offline · ultimo accesso ${formatDate(user.activity?.last_seen_at)}`
                          }
                        />
                        <Info
                          label="Cambio password obbligatorio"
                          value={user.must_change_password ? "Sì" : "No"}
                        />
                        {role === "professional" ? (
                          <>
                            <Info
                              label="Abbonamento"
                              value={subscriptionLabels[subscriptionStatus]}
                            />
                            <Info
                              label="Data rinnovo/fine periodo"
                              value={formatDate(user.subscription?.current_period_end)}
                            />
                          </>
                        ) : null}
                        {user.metrics ? (
                          Object.entries(user.metrics).map(([key, value]) => (
                            <Info
                              key={key}
                              label={key.replaceAll("_", " ")}
                              value={typeof value === "number" ? value.toFixed(key.includes("average") ? 1 : 0) : "—"}
                            />
                          ))
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <ActionButton
                          onClick={() =>
                            setPendingAction({
                              type: "ban",
                              user,
                              nextValue: !user.is_banned,
                            })
                          }
                        >
                          {user.is_banned ? "Riattiva account" : "Sospendi account"}
                        </ActionButton>
                        <ActionButton
                          onClick={() =>
                            void runUserAction(
                              user,
                              `/api/admin/users/${user.id}/send-password-reset`,
                              "Email reset password inviata.",
                            )
                          }
                        >
                          Invia reset password
                        </ActionButton>
                        <ActionButton
                          onClick={() =>
                            void runUserAction(
                              user,
                              `/api/admin/users/${user.id}/resend-confirmation`,
                              "Email conferma inviata.",
                            )
                          }
                        >
                          Invia conferma email
                        </ActionButton>
                        {role === "admin" ? (
                          <ActionButton
                            onClick={() =>
                              void runUserPatch(
                                user,
                                { must_change_password: true },
                                "Cambio password obbligatorio impostato.",
                              )
                            }
                          >
                            Forza cambio password
                          </ActionButton>
                        ) : null}
                        {role === "professional" ? (
                          <>
                            <ActionButton
                              onClick={() => void updateSubscription(user, "admin_forced_active")}
                            >
                              Forza abbonamento
                            </ActionButton>
                            <ActionButton onClick={() => void updateSubscription(user, "none")}>
                              Annulla forzatura
                            </ActionButton>
                            <ActionButton onClick={() => void updateSubscription(user, "suspended")}>
                              Sospendi abbonamento
                            </ActionButton>
                          </>
                        ) : null}
                        <ActionButton
                          danger
                          onClick={() => setPendingAction({ type: "delete", user })}
                        >
                          Elimina definitivamente
                        </ActionButton>
                      </div>
                      {busy === user.id ? (
                        <p className="mt-3 text-sm text-on-surface-variant">Operazione in corso…</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {pendingAction ? (
        <ConfirmActionModal
          title={
            pendingAction.type === "delete"
              ? "Eliminare questo account?"
              : pendingAction.nextValue
                ? "Sospendere questo account?"
                : "Riattivare questo account?"
          }
          body={
            pendingAction.type === "delete"
              ? "L’account verrà eliminato definitivamente da Supabase Auth e verrà avviata la pulizia dei dati collegati."
              : "L’utente perderà o riacquisterà l’accesso in base allo stato scelto."
          }
          confirmLabel={pendingAction.type === "delete" ? "Elimina account" : "Conferma"}
          busy={busy === pendingAction.user.id}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="font-label-md text-xs uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-primary">{value}</p>
    </div>
  );
}
