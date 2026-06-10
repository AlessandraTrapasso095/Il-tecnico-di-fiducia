"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { StartCheckoutButton } from "@/components/billing/start-checkout-button";
import { StartPortalButton } from "@/components/billing/start-portal-button";
import { fetchJson } from "@/lib/api/fetch-json";

type SubscriptionStatus = "none" | "stripe_active" | "admin_forced_active" | "suspended";

type SubscriptionResponse = {
  subscription: {
    professional_id: string;
    status: SubscriptionStatus;
    current_period_end: string | null;
    updated_at: string | null;
  } | null;
  is_active: boolean;
};

type SubscriptionSettingsClientProps = {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function fullName(profile: SubscriptionSettingsClientProps["profile"]) {
  return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email;
}

export default function SubscriptionSettingsClient({
  profile,
}: SubscriptionSettingsClientProps) {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubscription(
        await fetchJson<SubscriptionResponse>("/api/subscription", {
          method: "GET",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l’abbonamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchJson<SubscriptionResponse>("/api/subscription", { method: "GET" })
      .then((response) => {
        if (!mounted) return;
        setSubscription(response);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Impossibile caricare l’abbonamento.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const status = subscription?.subscription?.status ?? "none";
  const copy = useMemo(() => {
    if (status === "stripe_active") {
      return {
        title: "Abbonamento attivo",
        body: "Il tuo abbonamento Stripe è attivo. Da qui puoi aprire il portale Stripe per gestire metodo di pagamento, rinnovo e cancellazione.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-950",
        badge: "bg-emerald-500 text-white",
        dateLabel: "Prossimo rinnovo",
      };
    }

    if (status === "admin_forced_active") {
      return {
        title: "Abbonamento attivo forzato da admin",
        body: "La visibilità è stata abilitata manualmente da un amministratore. Puoi comunque passare a una gestione Stripe quando vuoi.",
        className: "border-lime-200 bg-lime-50 text-lime-950",
        badge: "bg-lime-600 text-white",
        dateLabel: "Fine/rinnovo",
      };
    }

    if (status === "suspended") {
      return {
        title: "Abbonamento sospeso",
        body: "La visibilità pubblica è sospesa. Riattiva l’abbonamento per tornare visibile e contattabile dai clienti.",
        className: "border-amber-200 bg-amber-50 text-amber-950",
        badge: "bg-amber-500 text-white",
        dateLabel: "Fine ultimo periodo",
      };
    }

    return {
      title: "Abbonamento non attivo",
      body: "Abbonati per farti vedere e contattare dai clienti. Il checkout Stripe parte solo da questa pagina.",
      className: "border-red-200 bg-red-50 text-red-950",
      badge: "bg-red-600 text-white",
      dateLabel: "Scadenza",
    };
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/professionista" className="flex items-center gap-3">
            <Image
              src="/img/logo-mark.png"
              alt="Il Tecnico di Fiducia"
              width={80}
              height={80}
              className="h-12 w-12 object-contain"
              priority
            />
            <span className="flex flex-col leading-none">
              <span className="font-headline-sm text-[20px] font-bold text-primary">
                Il tecnico
              </span>
              <span className="font-label-md text-[12px] font-extrabold uppercase tracking-[0.12em] text-on-tertiary-container">
                di fiducia
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/professionista"
              className="hidden rounded-full border border-primary px-5 py-2.5 font-button text-button text-primary transition hover:bg-primary hover:text-white sm:inline-flex"
            >
              Dashboard
            </Link>
            <SignOutButton className="rounded-full px-4 py-2 font-button text-button text-error hover:bg-error-container/40">
              Esci
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <div className="text-sm uppercase tracking-[0.18em] text-on-tertiary-container">
            Area professionista
          </div>
          <h1 className="mt-3 font-headline-md text-headline-md text-primary">
            Impostazioni abbonamento
          </h1>
          <p className="mt-4 text-on-surface-variant">
            Gestisci qui la visibilità del profilo e le azioni Stripe, senza partire
            direttamente dalla dashboard.
          </p>
          <div className="mt-6 rounded-2xl bg-surface-container-low p-4">
            <div className="font-label-md text-primary">{fullName(profile)}</div>
            <div className="mt-1 break-all text-sm text-on-surface-variant">
              {profile.email}
            </div>
          </div>
        </aside>

        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-8">
          {loading ? (
            <div className="rounded-2xl bg-surface-container-low p-6 text-on-surface-variant">
              Caricamento abbonamento…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-error-container p-6 text-on-error-container">
              {error}
            </div>
          ) : null}

          {!loading && subscription ? (
            <div className={`rounded-[24px] border p-6 ${copy.className}`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <span className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${copy.badge}`}>
                    {status}
                  </span>
                  <h2 className="mt-5 font-headline-md text-headline-md">
                    {copy.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-body-md leading-7 opacity-85">
                    {copy.body}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/65 px-5 py-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                    {copy.dateLabel}
                  </div>
                  <div className="mt-1 font-button">
                    {formatDate(subscription.subscription?.current_period_end)}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {status === "stripe_active" ? (
                  <StartPortalButton className="rounded-full bg-primary px-7 py-3 font-button text-button text-white shadow-md transition hover:bg-primary-container disabled:opacity-60">
                    Gestisci abbonamento
                  </StartPortalButton>
                ) : (
                  <StartCheckoutButton className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:opacity-60">
                    {status === "suspended"
                      ? "Riattiva abbonamento"
                      : status === "admin_forced_active"
                        ? "Passa a Stripe"
                        : "Attiva abbonamento"}
                  </StartCheckoutButton>
                )}

                <button
                  type="button"
                  onClick={() => void loadSubscription()}
                  className="rounded-full border-2 border-primary px-7 py-3 font-button text-button text-primary transition hover:bg-primary hover:text-white"
                >
                  Aggiorna stato
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
