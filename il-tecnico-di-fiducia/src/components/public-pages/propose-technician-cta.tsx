"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ApiError, fetchJson } from "@/lib/api/fetch-json";

type CheckoutResponse = {
  url: string;
};

const STORAGE_KEY = "profession-suggestion-form";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  professionName: "",
  motivation: "",
  suggestedSubcategories: "",
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function restoreForm() {
  if (typeof window === "undefined") return INITIAL_FORM;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_FORM;
    const parsed = JSON.parse(raw) as Partial<typeof INITIAL_FORM>;
    return {
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : "",
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      professionName:
        typeof parsed.professionName === "string" ? parsed.professionName : "",
      motivation: typeof parsed.motivation === "string" ? parsed.motivation : "",
      suggestedSubcategories:
        typeof parsed.suggestedSubcategories === "string"
          ? parsed.suggestedSubcategories
          : "",
    };
  } catch {
    return INITIAL_FORM;
  }
}

function inputClassName() {
  return "mt-2 h-12 w-full rounded-2xl border border-outline-variant bg-white px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
}

function textareaClassName(extraClassName = "") {
  return [
    "mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
    extraClassName,
  ].join(" ");
}

export function ProposeTechnicianCta() {
  const [form, setForm] = useState(() => restoreForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("checkout") === "cancelled";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const canSubmit = useMemo(() => {
    return (
      normalize(form.firstName).length > 0 &&
      normalize(form.lastName).length > 0 &&
      normalize(form.email).length > 0 &&
      normalize(form.professionName).length > 0 &&
      normalize(form.motivation).length >= 20
    );
  }, [form]);

  function updateField(field: keyof typeof INITIAL_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function startProposalCheckout(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCancelNotice(false);

    try {
      if (!canSubmit) {
        throw new Error("Compila tutti i campi obbligatori prima di continuare.");
      }

      const response = await fetchJson<CheckoutResponse>(
        "/api/profession-suggestions/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            first_name: normalize(form.firstName),
            last_name: normalize(form.lastName),
            email: normalize(form.email).toLowerCase(),
            profession_name: normalize(form.professionName),
            motivation: normalize(form.motivation),
            suggested_subcategories: normalize(form.suggestedSubcategories),
          }),
        },
      );

      if (!response.url) {
        throw new Error("Checkout non disponibile. Riprova.");
      }

      window.location.assign(response.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof ApiError || checkoutError instanceof Error
          ? checkoutError.message
          : "Non è stato possibile avviare il checkout. Riprova.",
      );
      setLoading(false);
    }
  }

  return (
    <form
      className="rounded-[32px] border border-outline-variant/30 bg-white p-6 shadow-[0_18px_60px_rgba(8,43,95,0.12)] sm:p-8"
      onSubmit={startProposalCheckout}
    >
      <p className="font-label-md text-sm uppercase tracking-[0.18em] text-[#FF8500]">
        Contributo valutazione
      </p>
      <h2 className="mt-3 font-headline-md text-[30px] leading-tight text-primary sm:text-[36px]">
        Vuoi proporre una nuova figura professionale?
      </h2>
      <p className="mt-4 leading-7 text-on-surface-variant">
        Compila i dati e prosegui al checkout Stripe sicuro per il contributo una
        tantum di €4,99.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block font-label-md text-primary">
          Nome
          <input
            className={inputClassName()}
            value={form.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            required
            autoComplete="given-name"
          />
        </label>
        <label className="block font-label-md text-primary">
          Cognome
          <input
            className={inputClassName()}
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="mt-4 block font-label-md text-primary">
        Email
        <input
          className={inputClassName()}
          type="email"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <label className="mt-4 block font-label-md text-primary">
        Nome della professione proposta
        <input
          className={inputClassName()}
          value={form.professionName}
          onChange={(event) => updateField("professionName", event.target.value)}
          required
          maxLength={120}
        />
      </label>

      <label className="mt-4 block font-label-md text-primary">
        Breve motivazione
        <textarea
          className={textareaClassName("min-h-28")}
          value={form.motivation}
          onChange={(event) => updateField("motivation", event.target.value)}
          required
          maxLength={450}
          placeholder="Spiega perché questa figura sarebbe utile sulla piattaforma."
        />
      </label>

      <label className="mt-4 block font-label-md text-primary">
        Eventuali sottocategorie suggerite
        <textarea
          className={textareaClassName("min-h-20")}
          value={form.suggestedSubcategories}
          onChange={(event) => updateField("suggestedSubcategories", event.target.value)}
          maxLength={350}
          placeholder="Esempio: consulenza, sopralluoghi, certificazioni..."
        />
      </label>

      {cancelNotice ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Checkout annullato. I dati compilati sono stati mantenuti: puoi modificarli
          e riprovare quando vuoi.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl bg-error-container p-4 text-sm leading-6 text-on-error-container">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={loading || !canSubmit}
      >
        {loading ? "Apertura checkout…" : "Proponi una figura professionale — €4,99"}
      </button>
    </form>
  );
}
