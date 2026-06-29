"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmActionModal } from "@/components/posts/post-media-ui";
import { fetchJson } from "@/lib/api/fetch-json";

type NotificationPreferences = {
  new_requests: boolean;
  messages: boolean;
  reviews: boolean;
  email: boolean;
};

type AdminSettingsClientProps = {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
  };
  preferences: NotificationPreferences;
};

export default function AdminSettingsClient({
  profile,
  preferences,
}: AdminSettingsClientProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email);
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences>(preferences);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetchJson<{ email_update_pending: boolean }>(
        "/api/admin/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
          }),
        },
      );
      setMessage(
        response.email_update_pending
          ? "Dati salvati. Controlla la nuova email per confermare il cambio indirizzo."
          : "Dati admin salvati.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNotifications() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ notifications: notificationPrefs }),
      });
      setMessage("Preferenze notifiche salvate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio notifiche non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: profile.email }),
      });
      setMessage("Ti abbiamo inviato un’email per cambiare la password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio email non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOwnAccount() {
    setDeleteLoading(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/account", { method: "DELETE" });
      setDeleteModalOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione account non riuscita.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {message ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div>
      ) : null}

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <h2 className="font-headline-sm text-[26px] text-primary">Dati profilo admin</h2>
        <form className="mt-5 space-y-4" onSubmit={saveProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nome" value={firstName} onChange={setFirstName} />
            <TextField label="Cognome" value={lastName} onChange={setLastName} />
          </div>
          <TextField label="Email" value={email} onChange={setEmail} type="email" />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-3 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Salvataggio…" : "Salva dati"}
            </button>
            <button
              type="button"
              className="rounded-full border border-primary px-5 py-3 font-button text-primary transition hover:bg-primary-fixed"
              disabled={loading}
              onClick={() => void sendPasswordReset()}
            >
              Cambia password via email
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <h2 className="font-headline-sm text-[26px] text-primary">Impostazioni notifiche</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="Nuove richieste"
            checked={notificationPrefs.new_requests}
            onChange={(value) =>
              setNotificationPrefs((current) => ({ ...current, new_requests: value }))
            }
          />
          <ToggleField
            label="Messaggi"
            checked={notificationPrefs.messages}
            onChange={(value) =>
              setNotificationPrefs((current) => ({ ...current, messages: value }))
            }
          />
          <ToggleField
            label="Recensioni"
            checked={notificationPrefs.reviews}
            onChange={(value) =>
              setNotificationPrefs((current) => ({ ...current, reviews: value }))
            }
          />
          <ToggleField
            label="Email"
            checked={notificationPrefs.email}
            onChange={(value) =>
              setNotificationPrefs((current) => ({ ...current, email: value }))
            }
          />
        </div>
        <button
          type="button"
          className="mt-5 rounded-full bg-primary px-5 py-3 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
          disabled={loading}
          onClick={() => void saveNotifications()}
        >
          Salva notifiche
        </button>
      </section>

      <section className="rounded-[24px] border border-error/30 bg-error-container/50 p-5">
        <h2 className="font-headline-sm text-[26px] text-error">Eliminazione account</h2>
        <p className="mt-2 text-on-error-container">
          L’eliminazione è definitiva e rimuove anche l’utente da Supabase Auth. Non è consentita
          se questo è l’ultimo admin.
        </p>
        <button
          type="button"
          className="mt-5 rounded-full bg-error px-5 py-3 font-button text-white transition hover:opacity-90"
          onClick={() => setDeleteModalOpen(true)}
        >
          Elimina definitivamente il mio account
        </button>
      </section>

      {deleteModalOpen ? (
        <ConfirmActionModal
          title="Eliminare il tuo account admin?"
          body="Questa azione è definitiva. Se non esiste un altro admin attivo, il sistema bloccherà l’eliminazione per sicurezza."
          confirmLabel="Elimina account"
          busy={deleteLoading}
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={() => void deleteOwnAccount()}
        />
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block font-label-md text-on-surface-variant">
      {label}
      <input
        className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container-low p-4 font-label-md text-primary">
      <span>{label}</span>
      <input
        className="h-5 w-5 accent-primary"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
