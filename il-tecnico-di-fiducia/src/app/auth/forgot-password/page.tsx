"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { fetchJson } from "@/lib/api/fetch-json";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const emailValue = useMemo(() => normalizeEmail(email), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setLoading(true);

    try {
      await fetchJson<{ ok: true }>("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: emailValue }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Recupera password
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Inserisci la tua email: riceverai un link per reimpostare la password.
        </p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Email
            </label>
            <input
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="nome@esempio.it"
              required
            />
          </div>

          {done ? (
            <div className="text-on-surface-variant bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-sm">
              Se l’email esiste, riceverai un messaggio con il link di recupero.
            </div>
          ) : null}

          {error ? (
            <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            className="w-full bg-[#FF8500] hover:bg-[#FF9A2B] text-white font-button text-button py-3 rounded-full transition-all duration-200 active:scale-[0.99] shadow-md disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Invio…" : "Invia link"}
          </button>
        </form>

        <div className="mt-6 text-center text-on-surface-variant">
          <Link className="text-primary font-bold hover:underline" href="/auth/login">
            Torna al login
          </Link>
        </div>
      </div>
  );
}
