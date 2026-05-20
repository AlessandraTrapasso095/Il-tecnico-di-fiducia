"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";

type UserRole = "customer" | "professional" | "admin";

type SignInResponse = {
  user: { id: string; email: string | null };
  profile: { id: string; role: UserRole; must_change_password: boolean; is_banned: boolean };
};

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function nextPathByRole(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/professional";
  return "/customer";
}

type LoginClientProps = {
  initialRole: "customer" | "professional";
};

export default function LoginClient({ initialRole }: LoginClientProps) {
  const router = useRouter();

  const [roleHint, setRoleHint] = useState<"customer" | "professional">(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValue = useMemo(() => normalizeEmail(email), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchJson<SignInResponse>("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: emailValue, password }),
      });

      if (res.profile.role === "admin" && res.profile.must_change_password) {
        router.push("/auth/change-password");
        return;
      }

      router.push(nextPathByRole(res.profile.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row">
      <section className="relative hidden md:flex md:w-5/12 lg:w-1/2 flex-col justify-between p-10 overflow-hidden bg-primary">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover opacity-80"
            alt="Sfondo login professionale"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6uWFYS_Qa4Y5naY6B0Ga_TwbReMdM9NY7SMO6z3bhvwqFiJNAz2M4_jMhtdN08umK3NUWGRYArxw1RtbGhK-pT-h1Jqpg36CxYxYHbvaDLCNN7K0LY-WPEfEI8iMaI1Jugz9ht-vEG2ZSpgnhaR89gSNyxQ06h3JAUcJSaLbXNUWUEgvQ-A8sJEu0zEnSqW0dZtCufswF0TY0D9RDBL6AJiTz7Wxgo-bvcCFHmhO3dets1UEDGHtZ9SjoIW061cAWJcPX68yFZooY"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary/60" />
        </div>

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            <div className="inline-flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-on-primary rounded-full flex items-center justify-center">
                <span className="text-primary text-[28px] font-bold">✓</span>
              </div>
              <h1 className="font-headline-sm text-headline-sm text-on-primary font-bold">
                Il tecnico di fiducia
              </h1>
            </div>
            <div className="max-w-md">
              <h2 className="font-display-lg text-display-lg text-on-primary mb-4">
                Bentornato
              </h2>
              <p className="font-body-lg text-body-lg text-primary-fixed-dim leading-relaxed">
                Accedi al tuo portale sicuro per gestire richieste, comunicazioni e
                attività. La tua tranquillità è la nostra priorità.
              </p>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/20 p-4 rounded-2xl max-w-sm">
            <p className="font-label-md text-label-md text-primary-fixed mb-1">
              CERTIFICAZIONE DI QUALITÀ
            </p>
            <p className="font-body-md text-body-md text-primary-fixed-dim">
              Accesso protetto e controlli anti‑abuso attivi.
            </p>
          </div>
        </div>
      </section>

      <section className="flex-1 flex items-center justify-center p-5 md:p-10 bg-surface-container-low">
        <div className="w-full max-w-[480px]">
          <div className="md:hidden flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <span className="text-on-primary text-[32px] font-bold">✓</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-primary">
              Il tecnico di fiducia
            </h1>
          </div>

          <div className="bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
            <div className="flex bg-surface-container-low p-1 rounded-full mb-6">
              <button
                type="button"
                className={[
                  "flex-1 py-3 px-4 rounded-full font-label-md text-label-md transition-all duration-200",
                  roleHint === "customer"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
                onClick={() => setRoleHint("customer")}
              >
                Cliente
              </button>
              <button
                type="button"
                className={[
                  "flex-1 py-3 px-4 rounded-full font-label-md text-label-md transition-all duration-200",
                  roleHint === "professional"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
                onClick={() => setRoleHint("professional")}
              >
                Professionista
              </button>
            </div>

            <div className="mb-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">
                Accesso Area {roleHint === "professional" ? "Professionista" : "Cliente"}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Inserisci le tue credenziali per continuare
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Indirizzo Email
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

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="font-label-md text-label-md text-on-surface-variant">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    Dimenticata?
                  </Link>
                </div>
                <input
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <label className="flex items-center gap-3 text-on-surface-variant">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="font-body-md text-body-md">
                  Ricordami su questo dispositivo
                </span>
              </label>

              {error ? (
                <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}

              <button
                className="w-full bg-[#FF8500] hover:bg-[#FF9A2B] text-white font-button text-button py-4 rounded-full transition-all duration-200 active:scale-[0.99] shadow-lg shadow-orange-500/20 disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Accesso…" : "Accedi"}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-outline-variant/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-container-lowest px-4 font-label-md text-label-md text-outline">
                  Oppure
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="font-body-md text-body-md text-on-surface-variant">
                Non hai ancora un account?{" "}
                <Link className="text-primary font-bold hover:underline" href="/auth/register">
                  Registrati ora
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-on-surface-variant">
            <Link className="font-label-md text-label-md hover:text-primary transition-colors" href="#">
              Centro Assistenza
            </Link>
            <Link className="font-label-md text-label-md hover:text-primary transition-colors" href="#">
              Privacy Policy
            </Link>
            <Link className="font-label-md text-label-md hover:text-primary transition-colors" href="#">
              Termini d’uso
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

