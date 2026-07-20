"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type DiscountCode = {
  id: string;
  stripe_coupon_id: string;
  stripe_promotion_code_id: string;
  code: string;
  title: string;
  percent_off: number;
  starts_at: string | null;
  expires_at: string | null;
  applies_to_all: boolean;
  professional_id: string | null;
  professional_email: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DiscountsResponse = {
  discounts: DiscountCode[];
};

type CreateDiscountResponse = {
  discount: DiscountCode;
  notified: number;
};

const PERCENT_PRESETS = ["10", "20", "30", "40", "50", "custom"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Senza scadenza";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(discount: DiscountCode) {
  if (!discount.is_active) return { text: "Disattivato", className: "bg-outline-variant text-on-surface" };
  if (discount.expires_at && new Date(discount.expires_at).getTime() <= Date.now()) {
    return { text: "Scaduto", className: "bg-error-container text-error" };
  }
  if (discount.starts_at && new Date(discount.starts_at).getTime() > Date.now()) {
    return { text: "Programmato", className: "bg-primary-fixed text-primary" };
  }
  return { text: "Attivo", className: "bg-emerald-100 text-emerald-700" };
}

function initialFormState() {
  return {
    title: "",
    code: "",
    percentPreset: "20",
    customPercent: "",
    startsAt: "",
    expiresAt: "",
    appliesToAll: true,
    professionalEmail: "",
    isActive: true,
  };
}

export default function DiscountCodesClient() {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPercent = useMemo(() => {
    if (form.percentPreset === "custom") {
      return Number.parseInt(form.customPercent, 10);
    }
    return Number.parseInt(form.percentPreset, 10);
  }, [form.customPercent, form.percentPreset]);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<DiscountsResponse>("/api/admin/subscription-discounts");
      setDiscounts(response.discounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare gli sconti.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDiscounts();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadDiscounts]);

  async function createDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetchJson<CreateDiscountResponse>(
        "/api/admin/subscription-discounts",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.title,
            code: form.code,
            percent_off: selectedPercent,
            starts_at: form.startsAt || null,
            expires_at: form.expiresAt || null,
            applies_to_all: form.appliesToAll,
            professional_email: form.appliesToAll ? null : form.professionalEmail,
            is_active: form.isActive,
          }),
        },
      );
      setMessage(
        `Codice ${response.discount.code} creato. Notifiche/email avviate per ${response.notified} professionisti.`,
      );
      setForm(initialFormState());
      await loadDiscounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione codice non riuscita.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDiscount(discount: DiscountCode) {
    setBusyId(discount.id);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/subscription-discounts/${discount.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !discount.is_active }),
      });
      setMessage(discount.is_active ? "Codice disattivato." : "Codice riattivato.");
      await loadDiscounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento codice non riuscito.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form
        onSubmit={createDiscount}
        className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:rounded-[28px] sm:p-6"
      >
        <div className="mb-5">
          <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
            Nuovo codice
          </p>
          <h2 className="mt-1 font-headline-sm text-[26px] text-primary">
            Crea sconto Stripe
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Il codice viene creato su Stripe e salvato nel database per mostrarlo solo ai professionisti idonei.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="font-label-md text-sm text-primary">Titolo</span>
            <input
              required
              className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Es. Black Friday Professionisti"
            />
          </label>

          <label className="block">
            <span className="font-label-md text-sm text-primary">Codice</span>
            <input
              required
              className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value }))
              }
              placeholder="BLACKFRIDAY20"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-label-md text-sm text-primary">Percentuale</span>
              <select
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.percentPreset}
                onChange={(event) =>
                  setForm((current) => ({ ...current, percentPreset: event.target.value }))
                }
              >
                {PERCENT_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset === "custom" ? "Personalizzata" : `${preset}%`}
                  </option>
                ))}
              </select>
            </label>
            {form.percentPreset === "custom" ? (
              <label className="block">
                <span className="font-label-md text-sm text-primary">Valore custom</span>
                <input
                  required
                  min={1}
                  max={100}
                  type="number"
                  className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={form.customPercent}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customPercent: event.target.value }))
                  }
                  placeholder="25"
                />
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-label-md text-sm text-primary">Inizio validità</span>
              <input
                type="date"
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startsAt: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="font-label-md text-sm text-primary">Fine validità</span>
              <input
                type="date"
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
              />
            </label>
          </div>

          <fieldset className="rounded-2xl border border-outline-variant/40 p-4">
            <legend className="px-2 font-label-md text-sm text-primary">Applicazione</legend>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  checked={form.appliesToAll}
                  onChange={() => setForm((current) => ({ ...current, appliesToAll: true }))}
                />
                Tutti i professionisti non abbonati
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  checked={!form.appliesToAll}
                  onChange={() => setForm((current) => ({ ...current, appliesToAll: false }))}
                />
                Singolo professionista
              </label>
              {!form.appliesToAll ? (
                <input
                  required
                  type="email"
                  className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={form.professionalEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      professionalEmail: event.target.value,
                    }))
                  }
                  placeholder="email@professionista.it"
                />
              ) : null}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-container-low p-4">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            <span>
              <span className="block font-label-md text-primary">Codice attivo</span>
              <span className="text-sm text-on-surface-variant">
                Se disattivato, viene salvato ma non mostrato ai professionisti.
              </span>
            </span>
          </label>
        </div>

        {message ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-5 rounded-2xl bg-error-container p-4 text-on-error-container">{error}</div> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 min-h-11 w-full rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creazione…" : "Crea codice sconto"}
        </button>
      </form>

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:rounded-[28px] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
              Codici reali
            </p>
            <h2 className="mt-1 font-headline-sm text-[26px] text-primary">
              Scontistiche create
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadDiscounts()}
            className="min-h-10 rounded-full border border-primary px-5 py-2 font-button text-primary transition hover:bg-primary hover:text-white"
          >
            Ricarica
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-5 text-on-surface-variant">
            Caricamento scontistiche…
          </div>
        ) : null}

        {!loading && discounts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-outline-variant p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined">percent</span>
            </div>
            <h3 className="mt-4 font-headline-sm text-[24px] text-primary">
              Nessuno sconto creato
            </h3>
            <p className="mt-2 text-on-surface-variant">
              I codici creati dagli admin appariranno qui con stato Stripe e DB.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          {discounts.map((discount) => {
            const status = statusLabel(discount);
            return (
              <article
                key={discount.id}
                className="rounded-[22px] border border-outline-variant/30 bg-surface-container-low p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary px-3 py-1 font-label-md text-sm text-white">
                        {discount.code}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                        {status.text}
                      </span>
                    </div>
                    <h3 className="mt-3 font-headline-sm text-[22px] text-primary">
                      {discount.title}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {discount.percent_off}% ·{" "}
                      {discount.applies_to_all
                        ? "Tutti i professionisti non abbonati"
                        : `Solo ${discount.professional_email ?? "professionista selezionato"}`}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Dal {formatDate(discount.starts_at)} · Al {formatDate(discount.expires_at)}
                    </p>
                    <p className="mt-2 break-all text-xs text-on-surface-variant">
                      Stripe: {discount.stripe_promotion_code_id}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === discount.id}
                    onClick={() => void toggleDiscount(discount)}
                    className={[
                      "min-h-10 rounded-full px-5 py-2 font-button transition disabled:cursor-not-allowed disabled:opacity-60",
                      discount.is_active
                        ? "bg-error-container text-error hover:bg-error/10"
                        : "bg-primary text-white hover:bg-primary-container",
                    ].join(" ")}
                  >
                    {busyId === discount.id
                      ? "Aggiornamento…"
                      : discount.is_active
                        ? "Disattiva"
                        : "Riattiva"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
