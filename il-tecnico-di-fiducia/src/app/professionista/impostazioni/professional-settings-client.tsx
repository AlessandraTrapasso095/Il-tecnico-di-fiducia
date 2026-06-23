"use client";

import { useMemo, useState } from "react";

import { ConfirmActionModal } from "@/components/posts/post-media-ui";
import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";

type NotificationPreferences = {
  new_requests: boolean;
  messages: boolean;
  reviews: boolean;
  email: boolean;
};

type ProfessionalSettingsClientProps = {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    province_code: string | null;
    phone: string | null;
  };
  preferences: NotificationPreferences;
};

type SettingsResponse = {
  ok: true;
  email_update_pending: boolean;
};

const DEFAULT_CONFIRM_TEXT = "ELIMINA";

export default function ProfessionalSettingsClient({
  profile,
  preferences,
}: ProfessionalSettingsClientProps) {
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email);
  const [provinceCode, setProvinceCode] = useState(profile.province_code ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [notificationSettings, setNotificationSettings] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = useMemo(
    () => deleteConfirm.trim().toUpperCase() === DEFAULT_CONFIRM_TEXT,
    [deleteConfirm],
  );

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchJson<SettingsResponse>("/api/account/settings", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          province_code: provinceCode,
          phone,
          notifications: notificationSettings,
        }),
      });
      setMessage(
        response.email_update_pending
          ? "Dati salvati. Controlla la nuova email per confermare il cambio indirizzo."
          : "Impostazioni salvate.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    setResetSending(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson<{ ok: true }>("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: profile.email }),
      });
      setMessage("Ti abbiamo inviato un’email per cambiare la password.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Email non inviata.");
    } finally {
      setResetSending(false);
    }
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await fetchJson<{ ok: true }>("/api/account", { method: "DELETE" });
      window.location.href = "/";
    } catch (accountError) {
      setDeleteError(
        accountError instanceof Error ? accountError.message : "Eliminazione non riuscita.",
      );
      setDeleting(false);
    }
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    setNotificationSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="font-label-md text-label-md uppercase tracking-[0.18em] text-on-tertiary-container">
          Area professionista
        </p>
        <h1 className="mt-2 font-headline-md text-headline-md text-primary">
          Impostazioni
        </h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Gestisci i dati account, le notifiche e le azioni di sicurezza del tuo profilo.
        </p>
      </div>

      <form className="space-y-6" onSubmit={saveSettings}>
        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-headline-sm text-[24px] text-primary">Dati account</h2>
              <p className="text-on-surface-variant">
                Email e password seguono i flussi sicuri Supabase con conferma via email.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border-2 border-primary px-5 py-3 font-button text-primary transition hover:bg-primary hover:text-white disabled:opacity-60"
              disabled={resetSending}
              onClick={() => void sendPasswordReset()}
            >
              {resetSending ? "Invio…" : "Cambia password"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" value={firstName} onChange={setFirstName} required />
            <Field label="Cognome" value={lastName} onChange={setLastName} required />
            <Field label="Email" value={email} onChange={setEmail} type="email" required />
            <Field label="Telefono" value={phone} onChange={setPhone} type="tel" />
            <label className="block font-label-md text-primary sm:col-span-2">
              Provincia
              <select
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={provinceCode}
                onChange={(event) => setProvinceCode(event.target.value)}
                required
              >
                <option value="">Seleziona provincia</option>
                {ITALIAN_PROVINCES_BY_NAME.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <h2 className="font-headline-sm text-[24px] text-primary">
            Impostazioni notifiche
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ToggleRow
              title="Nuove richieste"
              description="Avvisi quando ricevi nuove richieste dai clienti."
              checked={notificationSettings.new_requests}
              onToggle={() => toggleNotification("new_requests")}
            />
            <ToggleRow
              title="Messaggi"
              description="Avvisi per nuovi messaggi nelle conversazioni."
              checked={notificationSettings.messages}
              onToggle={() => toggleNotification("messages")}
            />
            <ToggleRow
              title="Recensioni"
              description="Avvisi quando ricevi nuove recensioni o interazioni."
              checked={notificationSettings.reviews}
              onToggle={() => toggleNotification("reviews")}
            />
            <ToggleRow
              title="Email"
              description="Consenti notifiche importanti anche via email."
              checked={notificationSettings.email}
              onToggle={() => toggleNotification("email")}
            />
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-error-container p-4 text-on-error-container">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-[#FF8500] px-8 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Salvataggio…" : "Salva impostazioni"}
          </button>
        </div>
      </form>

      <section className="mt-8 rounded-[28px] border border-error/20 bg-error-container/40 p-6">
        <h2 className="font-headline-sm text-[24px] text-error">Eliminazione account</h2>
        <p className="mt-2 max-w-2xl text-on-error-container">
          Questa azione elimina definitivamente il tuo account, i file collegati e l’utente da Supabase Auth.
        </p>
        <button
          type="button"
          className="mt-5 rounded-full border-2 border-error px-6 py-3 font-button text-error transition hover:bg-error hover:text-white"
          onClick={() => setDeleteOpen(true)}
        >
          Elimina definitivamente account
        </button>
      </section>

      {deleteOpen ? (
        <ConfirmActionModal
          title="Eliminare definitivamente l’account?"
          body="Questa azione non può essere annullata. Scrivi ELIMINA nel campo richiesto e conferma per procedere."
          confirmLabel="Elimina account"
          busy={deleting}
          confirmDisabled={!canDelete}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setDeleteOpen(false);
            setDeleteConfirm("");
            setDeleteError(null);
          }}
          onConfirm={() => void deleteAccount()}
        >
          <label className="mt-4 block font-label-md text-primary">
            Conferma scrivendo {DEFAULT_CONFIRM_TEXT}
            <input
              className="mt-2 w-full rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              disabled={deleting}
            />
          </label>
          {!canDelete ? (
            <p className="mt-2 text-sm text-on-surface-variant">
              Il pulsante funziona solo dopo la conferma esplicita.
            </p>
          ) : null}
        </ConfirmActionModal>
      ) : null}
    </main>
  );
}

function Field({
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
    <label className="block font-label-md text-primary">
      {label}
      <input
        className="mt-2 w-full rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container-low p-4 text-left"
      onClick={onToggle}
    >
      <span>
        <span className="block font-label-md text-primary">{title}</span>
        <span className="mt-1 block text-sm text-on-surface-variant">{description}</span>
      </span>
      <span
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-[#FF8500]" : "bg-outline-variant",
        ].join(" ")}
        aria-hidden="true"
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-6" : "left-1",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
