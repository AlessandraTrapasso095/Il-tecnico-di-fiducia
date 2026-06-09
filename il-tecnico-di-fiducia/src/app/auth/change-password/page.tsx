"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";

type MeResponse = {
  user: { id: string; email: string | null };
  profile: { id: string; role: "customer" | "professional" | "admin"; must_change_password: boolean };
};

function nextPathByRole(role: MeResponse["profile"]["role"]) {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/professional";
  return "/customer";
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchJson<MeResponse>("/api/me", { method: "GET" })
      .then((res) => {
        if (!mounted) return;
        setMe(res);
      })
      .catch(() => {
        // unauth
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }

    setLoading(true);
    try {
      await fetchJson<{ ok: true }>("/api/auth/update-password", {
        method: "POST",
        body: JSON.stringify({ new_password: password }),
      });
      setDone(true);
      router.push(me ? nextPathByRole(me.profile.role) : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[448px] bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Aggiorna password
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Per sicurezza, ti chiediamo di impostare una nuova password prima di continuare.
        </p>

        {loading && !me ? (
          <div className="text-on-surface-variant">Caricamento…</div>
        ) : !me ? (
          <div className="space-y-4">
            <div className="text-on-surface-variant">
              Sessione non valida. Effettua il login.
            </div>
            <button
              className="w-full bg-primary text-white rounded-full py-3 font-button text-button hover:bg-secondary transition-colors"
              onClick={() => router.push("/auth/login")}
              type="button"
            >
              Vai al login
            </button>
          </div>
        ) : done ? (
          <div className="text-on-surface-variant">Password aggiornata.</div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Nuova password
              </label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Conferma password
              </label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error ? (
              <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}

            <button
              className="w-full bg-[#FF8500] hover:bg-[#FF9A2B] text-white rounded-full py-3 font-button text-button shadow-md transition-all active:scale-[0.99] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Aggiornamento…" : "Aggiorna password"}
            </button>
          </form>
        )}
      </div>
  );
}
