"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CheckoutResponse = {
  url: string;
};

type CheckoutErrorResponse = {
  error?: string;
};

const STORAGE_KEY = "profession-suggestion-form";
const CHECKOUT_ENDPOINT = "/api/profession-suggestions/checkout";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function checkoutStatusFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("checkout");
}

function clearCheckoutParams() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  const search = url.searchParams.toString();
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${search ? `?${search}` : ""}${url.hash}`,
  );
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
  const restoredRef = useRef(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setForm(restoreForm());
      setCancelNotice(checkoutStatusFromUrl() === "cancelled");
      setSuccessOpen(checkoutStatusFromUrl() === "success");
      restoredRef.current = true;
    }, 0);

    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restoredRef.current) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const invalidFields = useMemo(() => {
    const nextInvalidFields: string[] = [];

    if (normalize(form.firstName).length === 0) nextInvalidFields.push("nome");
    if (normalize(form.lastName).length === 0) nextInvalidFields.push("cognome");
    if (!EMAIL_RE.test(normalize(form.email).toLowerCase())) {
      nextInvalidFields.push("email valida");
    }
    if (normalize(form.professionName).length === 0) {
      nextInvalidFields.push("professione proposta");
    }
    if (normalize(form.motivation).length < 20) {
      nextInvalidFields.push("motivazione di almeno 20 caratteri");
    }

    return nextInvalidFields;
  }, [form]);
  const canSubmit = invalidFields.length === 0;
  const submitDisabled = loading || !canSubmit;
  const helperMessage = canSubmit
    ? "Tutto pronto: puoi aprire il checkout Stripe sicuro."
    : `Completa: ${invalidFields.join(", ")}.`;

  function updateField(field: keyof typeof INITIAL_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function startProposalCheckout(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCancelNotice(false);

    try {
      if (process.env.NODE_ENV !== "production") {
        console.info("[profession-suggestion] submit state", {
          disabled: submitDisabled,
          loading,
          canSubmit,
          invalidFields,
          endpoint: CHECKOUT_ENDPOINT,
        });
      }

      if (!canSubmit) {
        throw new Error(`Controlla i campi: ${invalidFields.join(", ")}.`);
      }

      const checkoutResponse = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: normalize(form.firstName),
          last_name: normalize(form.lastName),
          email: normalize(form.email).toLowerCase(),
          profession_name: normalize(form.professionName),
          motivation: normalize(form.motivation),
          suggested_subcategories: normalize(form.suggestedSubcategories),
        }),
      });
      const responseBody = (await checkoutResponse.json().catch(() => null)) as
        | (CheckoutResponse & CheckoutErrorResponse)
        | null;

      if (process.env.NODE_ENV !== "production") {
        console.info("[profession-suggestion] checkout response", {
          endpoint: CHECKOUT_ENDPOINT,
          status: checkoutResponse.status,
          ok: checkoutResponse.ok,
          body: {
            error: responseBody?.error ?? null,
            hasUrl: Boolean(responseBody?.url),
            urlHost: responseBody?.url ? new URL(responseBody.url).host : null,
          },
        });
      }

      if (!checkoutResponse.ok) {
        throw new Error(
          responseBody?.error ?? "Non è stato possibile avviare il checkout. Riprova.",
        );
      }

      if (!responseBody?.url) {
        throw new Error("Checkout non disponibile. Riprova.");
      }

      window.location.assign(responseBody.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Non è stato possibile avviare il checkout. Riprova.",
      );
      setLoading(false);
    }
  }

  function closeSuccessModal() {
    setSuccessOpen(false);
    setCancelNotice(false);
    setForm(INITIAL_FORM);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    clearCheckoutParams();
  }

  return (
    <>
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

        <button
          type="submit"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={submitDisabled}
          aria-disabled={submitDisabled}
        >
          {loading ? "Apertura checkout…" : "Proponi una figura professionale — €4,99"}
        </button>

        <p className="mt-3 text-center text-sm leading-6 text-on-surface-variant">
          {loading ? "Creazione della sessione di pagamento in corso…" : helperMessage}
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-4 text-sm leading-6 text-on-error-container">
            {error}
          </div>
        ) : null}
      </form>

      {successOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profession-suggestion-success-title"
        >
          <div className="max-h-[calc(100dvh-32px)] w-full max-w-lg overflow-y-auto rounded-[32px] border border-white/50 bg-white p-6 text-center shadow-[0_30px_90px_rgba(8,43,95,0.28)] transition-all duration-300 sm:p-8">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#FF8500]/10 text-[#FF8500]">
              <span className="material-symbols-outlined text-[40px]" aria-hidden>
                check_circle
              </span>
            </div>
            <h2
              id="profession-suggestion-success-title"
              className="mt-5 font-headline-md text-[34px] leading-tight text-primary"
            >
              Tutto fatto! 🎉
            </h2>
            <div className="mt-4 space-y-4 text-base leading-7 text-on-surface-variant">
              <p>Abbiamo ricevuto correttamente la tua proposta.</p>
              <p>
                Il nostro team analizzerà la nuova figura professionale e lavorerà
                per valutarne l&apos;inserimento nella piattaforma.
              </p>
              <p>
                Generalmente completiamo questa verifica entro circa una settimana.
              </p>
              <p>
                Grazie per aver contribuito a rendere Il Tecnico di Fiducia una
                piattaforma sempre più completa.
              </p>
            </div>
            <button
              type="button"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF8500] px-8 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B]"
              onClick={closeSuccessModal}
            >
              Perfetto
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
