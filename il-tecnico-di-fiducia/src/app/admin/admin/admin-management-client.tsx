"use client";

import { useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { fetchJson } from "@/lib/api/fetch-json";

export default function AdminManagementClient() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setReloadSignal((value) => value + 1);
      setMessage("Nuovo admin creato. Al primo login dovrà cambiare password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione admin non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <h2 className="font-headline-sm text-[26px] text-primary">Aggiungi nuovo admin</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          La password è provvisoria: al primo login verrà richiesto il cambio.
        </p>
        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div>
        ) : null}
        <form className="mt-5 space-y-4" onSubmit={createAdmin}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nome" value={firstName} onChange={setFirstName} required />
            <TextField label="Cognome" value={lastName} onChange={setLastName} required />
          </div>
          <TextField label="Email" value={email} onChange={setEmail} type="email" required />
          <PasswordField
            label="Password provvisoria"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="submit"
            className="rounded-full bg-[#FF8500] px-5 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Creazione…" : "Crea admin"}
          </button>
        </form>
      </section>

      <AdminUsersClient role="admin" reloadSignal={reloadSignal} />
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
