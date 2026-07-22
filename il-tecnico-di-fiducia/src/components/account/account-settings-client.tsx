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

type AccountSettingsClientProps = {
  areaLabel: string;
  title?: string;
  description?: string;
  requireProvince?: boolean;
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
const PASSWORD_MIN_LENGTH = 8;

function normalizeTrim(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default function AccountSettingsClient({
  areaLabel,
  title = "Impostazioni",
  description = "Gestisci i dati account, la sicurezza e le notifiche del tuo profilo.",
  requireProvince = false,
  profile,
  preferences,
}: AccountSettingsClientProps) {
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email);
  const [provinceCode, setProvinceCode] = useState(profile.province_code ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [notificationSettings, setNotificationSettings] = useState(preferences);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const cleanFirstName = normalizeTrim(firstName);
    const cleanLastName = normalizeTrim(lastName);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanFirstName || !cleanLastName) {
      setError("Nome e cognome sono obbligatori.");
      return;
    }

    if (!cleanEmail) {
      setError("Email obbligatoria.");
      return;
    }

    if (requireProvince && !provinceCode) {
      setError("Seleziona una provincia.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchJson<SettingsResponse>("/api/account/settings", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: cleanFirstName,
          last_name: cleanLastName,
          email: cleanEmail,
          province_code: provinceCode || null,
          phone: cleanPhone || null,
          notifications: notificationSettings,
        }),
      });

      setFirstName(cleanFirstName);
      setLastName(cleanLastName);
      setEmail(cleanEmail);
      setPhone(cleanPhone);
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

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri.`);
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Le password non coincidono.");
      }

      await fetchJson<{ ok: true }>("/api/auth/update-password", {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password aggiornata correttamente.");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error ? passwordError.message : "Cambio password non riuscito.",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await fetchJson<{ ok: true }>("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirm: DEFAULT_CONFIRM_TEXT }),
      });
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
          {areaLabel}
        </p>
        <h1 className="mt-2 font-headline-md text-headline-md text-primary">{title}</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">{description}</p>
      </div>

      <form className="space-y-6" onSubmit={saveSettings}>
        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
          <div className="mb-5">
            <h2 className="font-headline-sm text-[24px] text-primary">Dati account</h2>
            <p className="text-on-surface-variant">
              Email e password seguono i flussi sicuri Supabase con conferma via email.
            </p>
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
                required={requireProvince}
              >
                <option value="">
                  {requireProvince ? "Seleziona provincia" : "Provincia non indicata"}
                </option>
                {ITALIAN_PROVINCES_BY_NAME.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
          <h2 className="font-headline-sm text-[24px] text-primary">Impostazioni notifiche</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ToggleRow
              title="Nuove richieste"
              description="Avvisi quando ricevi nuove richieste."
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

      <form
        className="mt-8 rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6"
        onSubmit={savePassword}
      >
        <h2 className="font-headline-sm text-[24px] text-primary">Password</h2>
        <p className="mt-1 text-on-surface-variant">
          Scegli una nuova password di almeno {PASSWORD_MIN_LENGTH} caratteri.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nuova password"
            value={newPassword}
            onChange={setNewPassword}
            type="password"
            required
          />
          <Field
            label="Conferma nuova password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            required
          />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className="rounded-full border-2 border-primary px-6 py-3 font-button text-primary transition hover:bg-primary hover:text-white disabled:opacity-60"
            disabled={passwordSaving}
          >
            {passwordSaving ? "Aggiornamento…" : "Aggiorna password"}
          </button>
        </div>
      </form>

      <section className="mt-8 rounded-[28px] border border-error/20 bg-error-container/40 p-5 sm:p-6">
        <h2 className="font-headline-sm text-[24px] text-error">Eliminazione account</h2>
        <p className="mt-2 max-w-2xl text-on-error-container">
          Questa azione è definitiva. I dati collegati vengono rimossi secondo i vincoli reali
          del database; eventuali conversazioni, ticket o log necessari alla sicurezza possono
          restare anonimizzati o conservati se richiesto dalle regole tecniche.
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
          body="Questa azione non può essere annullata. Se hai un abbonamento Stripe attivo, dovrai prima cancellarlo dal portale abbonamento."
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
