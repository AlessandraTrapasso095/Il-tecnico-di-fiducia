"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { fetchJson } from "@/lib/api/fetch-json";

type AdminSignInResponse = {
  profile: {
    role: "admin" | "customer" | "professional";
    must_change_password: boolean;
  };
};

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export default function AdminLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValue = useMemo(() => normalizeEmail(email), [email]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetchJson<AdminSignInResponse>("/api/admin/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: emailValue, password }),
      });

      if (response.profile.must_change_password) {
        router.push("/auth/change-password");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso admin non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-3 py-6 text-on-surface sm:px-4 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1180px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_60px_rgba(8,43,95,0.14)] sm:rounded-[32px] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="relative hidden overflow-hidden bg-primary p-10 text-white lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,133,0,0.22),transparent_28%),linear-gradient(135deg,#002654,#0b3c78)]" />
            <div className="relative z-10 flex min-h-[620px] flex-col justify-between">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-lg">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                </span>
                <span>
                  <span className="block font-headline-sm text-[24px] leading-none">
                    Il Tecnico
                  </span>
                  <span className="block font-label-md text-[#FF8500]">
                    di Fiducia
                  </span>
                </span>
              </Link>

              <div>
                <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 font-label-md text-sm text-primary-fixed">
                  Area riservata amministratori
                </p>
                <h1 className="font-display-lg text-[52px] leading-tight">
                  Accesso sicuro al pannello admin
                </h1>
                <p className="mt-5 max-w-[520px] text-lg leading-8 text-primary-fixed">
                  Gestisci clienti, professionisti, ticket e abbonamenti con controlli
                  protetti lato server.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 text-primary-fixed backdrop-blur">
                Gli account admin con password provvisoria devono cambiarla al primo login.
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-4 py-8 sm:px-10 sm:py-10">
            <div className="w-full max-w-[460px]">
              <div className="mb-8 lg:hidden">
                <Link href="/" className="font-headline-sm text-[24px] text-primary">
                  Il Tecnico <span className="text-[#FF8500]">di Fiducia</span>
                </Link>
              </div>

              <div className="mb-8">
                <p className="mb-3 font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
                  Admin login
                </p>
                <h2 className="font-headline-md text-[28px] leading-tight text-primary sm:text-[34px]">
                  Accedi come amministratore
                </h2>
                <p className="mt-2 text-on-surface-variant">
                  Usa solo credenziali admin autorizzate.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <label className="block font-label-md text-on-surface-variant">
                  Email admin
                  <input
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="admin@iltecnicodifiducia.it"
                    required
                  />
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-label-md text-on-surface-variant">
                      Password
                    </span>
                    <Link
                      href="/auth/forgot-password"
                      className="font-label-md text-primary hover:underline"
                    >
                      Password dimenticata?
                    </Link>
                  </div>
                  <PasswordField
                    label=""
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-full bg-[#FF8500] px-6 py-4 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Accesso admin…" : "Accedi come admin"}
                </button>
              </form>

              <div className="mt-8 flex flex-wrap justify-center gap-5 text-sm text-on-surface-variant">
                <Link href="/" className="hover:text-primary">
                  Torna alla home
                </Link>
                <Link href="/privacy" className="hover:text-primary">
                  Privacy
                </Link>
                <Link href="/termini" className="hover:text-primary">
                  Termini
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
