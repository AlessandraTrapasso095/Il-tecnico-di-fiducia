"use client";

import { useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { fetchJson } from "@/lib/api/fetch-json";

type AdminSettingsClientProps = {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
  };
};

export default function AdminSettingsClient({ profile }: AdminSettingsClientProps) {
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email);
  const [newAdminFirstName, setNewAdminFirstName] = useState("");
  const [newAdminLastName, setNewAdminLastName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
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

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    setAdminLoading(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          first_name: newAdminFirstName,
          last_name: newAdminLastName,
          email: newAdminEmail,
          password: newAdminPassword,
        }),
      });
      setNewAdminFirstName("");
      setNewAdminLastName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setMessage("Nuovo admin creato. Al primo login dovrà cambiare password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione admin non riuscita.");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div>
      ) : null}

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <h2 className="font-headline-sm text-[26px] text-primary">Profilo admin</h2>
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
        <h2 className="font-headline-sm text-[26px] text-primary">Aggiungi nuovo admin</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          La password è provvisoria: al primo login verrà richiesto il cambio.
        </p>
        <form className="mt-5 space-y-4" onSubmit={createAdmin}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nome"
              value={newAdminFirstName}
              onChange={setNewAdminFirstName}
              required
            />
            <TextField
              label="Cognome"
              value={newAdminLastName}
              onChange={setNewAdminLastName}
              required
            />
          </div>
          <TextField
            label="Email"
            value={newAdminEmail}
            onChange={setNewAdminEmail}
            type="email"
            required
          />
          <PasswordField
            label="Password provvisoria"
            value={newAdminPassword}
            onChange={setNewAdminPassword}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="submit"
            className="rounded-full bg-[#FF8500] px-5 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={adminLoading}
          >
            {adminLoading ? "Creazione…" : "Crea admin"}
          </button>
        </form>
      </section>
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
