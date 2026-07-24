"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/auth/password-field";
import { fetchJson } from "@/lib/api/fetch-json";
import {
  ITALIAN_PROVINCES_BY_NAME,
  normalizeItalianProvinceCode,
  type ItalianProvince,
} from "@/lib/locations/italian-provinces";
import {
  normalizeProfessionCategories,
  professionCategoryKey,
  type DbProfessionCategory,
  type ProfessionCategory,
  type ProfessionSubcategory,
} from "@/lib/professions/taxonomy";
import { nextPathByRole } from "@/lib/routes/role-paths";

type Role = "customer" | "professional";

type ProvincesResponse = { provinces: ItalianProvince[] };
type CategoriesResponse = { categories: DbProfessionCategory[] };

type SignUpResponse = {
  ok: true;
  email: string;
  requires_email_otp: true;
};

type ConfirmOtpResponse = {
  user: { id: string; email: string | null; email_confirmed_at: string | null };
  profile: { id: string; role: Role | "admin" };
};

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function normalizeOtp(raw: string) {
  return raw.replace(/\s+/g, "").trim();
}

function categoryOptionValue(category: ProfessionCategory) {
  return category.id !== null && category.id !== undefined
    ? `id:${category.id}`
    : professionCategoryKey(category);
}

function categoryIdFromOption(value: string) {
  return value.startsWith("id:") ? value.slice(3) : "";
}

function subcategoryOptionValue(subcategory: ProfessionSubcategory) {
  return subcategory.id ? `id:${subcategory.id}` : `slug:${subcategory.slug}`;
}

function subcategoryIdFromOption(value: string) {
  return value.startsWith("id:") ? value.slice(3) : "";
}

type RegisterClientProps = {
  initialRole: Role;
};

export default function RegisterClient({ initialRole }: RegisterClientProps) {
  const router = useRouter();

  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState<"form" | "otp">("form");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [provinceCode, setProvinceCode] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [subcategoryKey, setSubcategoryKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [otp, setOtp] = useState("");

  const [provinces, setProvinces] = useState<ItalianProvince[]>(ITALIAN_PROVINCES_BY_NAME);
  const [categories, setCategories] = useState<ProfessionCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);

  const emailValue = useMemo(() => normalizeEmail(email), [email]);
  const currentCategory = useMemo(
    () => categories.find((category) => categoryOptionValue(category) === categoryKey) ?? null,
    [categories, categoryKey],
  );
  const currentSubcategories = useMemo(
    () => currentCategory?.subcategories ?? [],
    [currentCategory],
  );
  const currentSubcategory = useMemo(
    () =>
      currentSubcategories.find(
        (subcategory) => subcategoryOptionValue(subcategory) === subcategoryKey,
      ) ?? null,
    [currentSubcategories, subcategoryKey],
  );

  useEffect(() => {
    let mounted = true;
    fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" })
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.provinces) && res.provinces.length > 0) {
          setProvinces(res.provinces);
        }
      })
      .catch(() => {
        // optional
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (role !== "professional" || categories.length > 0 || categoriesLoading) return;

    let mounted = true;
    Promise.resolve()
      .then(() => {
        if (!mounted) return null;
        setCategoriesLoading(true);
        setCategoriesError(null);
        return fetchJson<CategoriesResponse>("/api/categories", { method: "GET" });
      })
      .then((res) => {
        if (!mounted || !res) return;
        const nextCategories = normalizeProfessionCategories(res.categories ?? []);
        setCategories(nextCategories);
        if (nextCategories.length === 0) {
          setCategoriesError("Nessuna categoria attiva disponibile al momento.");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setCategories([]);
        setCategoriesError("Non è stato possibile caricare le categorie. Riprova.");
      })
      .finally(() => {
        if (mounted) setCategoriesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [categories.length, categoriesLoading, categoriesReloadKey, role]);

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOtpError(null);
    setOtpInfo(null);

    const normalizedProvinceCode = normalizeItalianProvinceCode(provinceCode);
    if (!normalizedProvinceCode) {
      setError("Seleziona la tua provincia.");
      return;
    }

    const selectedCategoryId = categoryIdFromOption(categoryKey);
    if (role === "professional" && !selectedCategoryId) {
      setError("Seleziona una categoria");
      return;
    }

    setLoading(true);

    try {
      const res = await fetchJson<SignUpResponse>("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({
          role,
          email: emailValue,
          password,
          first_name: firstName,
          last_name: lastName,
          province_code: normalizedProvinceCode,
          phone: phone || null,
          category_id: role === "professional" ? selectedCategoryId : null,
          subcategory_id:
            role === "professional" && currentSubcategory
              ? subcategoryIdFromOption(subcategoryOptionValue(currentSubcategory)) || null
              : null,
          accept_terms: acceptTerms,
        }),
      });

      setStep("otp");
      setOtp("");
      setOtpInfo(`Abbiamo inviato un codice a ${res.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);
    setLoading(true);

    try {
      const token = normalizeOtp(otp);
      const res = await fetchJson<ConfirmOtpResponse>("/api/auth/confirm-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: emailValue, token }),
      });

      router.push(nextPathByRole(res.profile.role));
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  async function onResendOtp() {
    setOtpError(null);
    setOtpInfo(null);
    setLoading(true);
    try {
      await fetchJson<{ ok: true }>("/api/auth/resend-signup-otp", {
        method: "POST",
        body: JSON.stringify({ email: emailValue }),
      });
      setOtpInfo("Codice reinviato.");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] bg-surface-container-lowest rounded-[28px] shadow-[0_8px_30px_rgba(8,43,95,0.10)] border border-outline-variant/30 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-outline-variant/30 bg-surface-container-lowest">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-headline-sm text-primary text-[18px] truncate">
                Il tecnico di fiducia
              </div>
              <div className="text-[12px] text-on-surface-variant">
                Crea un account e verifica l’email
              </div>
            </div>
            <Link
              href="/auth/login"
              className="font-button text-button text-primary px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors shrink-0"
            >
              Log In
            </Link>
          </div>
        </div>

        {step === "form" ? (
          <form className="p-6 sm:p-8 space-y-5" onSubmit={onSignUp}>
            <div className="flex bg-surface-container-low p-1 rounded-full">
              <button
                type="button"
                className={[
                  "flex-1 py-3 px-4 rounded-full font-label-md text-label-md transition-all duration-200",
                  role === "customer"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
                onClick={() => setRole("customer")}
              >
                Cliente
              </button>
              <button
                type="button"
                className={[
                  "flex-1 py-3 px-4 rounded-full font-label-md text-label-md transition-all duration-200",
                  role === "professional"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
                onClick={() => setRole("professional")}
              >
                Professionista
              </button>
            </div>

            <div>
              <h1 className="font-headline-md text-headline-md text-primary mb-1">
                Crea il tuo account
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {role === "professional"
                  ? "Crea il tuo profilo tecnico e completa i dati dopo la verifica email."
                  : "Inizia subito a trovare il professionista giusto per te."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Nome
                </label>
                <input
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Es. Mario"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Cognome
                </label>
                <input
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  placeholder="Es. Rossi"
                  required
                />
              </div>
            </div>

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
                placeholder="mario.rossi@esempio.it"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Provincia
                </label>
                <select
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                  value={provinceCode}
                  onChange={(e) => setProvinceCode(e.target.value)}
                  required
                >
                  <option value="">Seleziona provincia</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Telefono (opzionale)
                </label>
                <input
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+39 333 1234567"
                />
              </div>
            </div>

            {role === "professional" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">
                    Categoria
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md disabled:bg-surface-container-low disabled:text-outline"
                    value={categoryKey}
                    onChange={(e) => {
                      setCategoryKey(e.target.value);
                      setSubcategoryKey("");
                    }}
                    required
                    disabled={categoriesLoading || Boolean(categoriesError)}
                  >
                    <option value="">
                      {categoriesLoading ? "Caricamento categorie…" : "Seleziona una categoria"}
                    </option>
                    {categories.map((category) => (
                      <option key={categoryOptionValue(category)} value={categoryOptionValue(category)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {categoriesError ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-error">
                      <span>{categoriesError}</span>
                      <button
                        type="button"
                        className="font-label-md text-label-md underline underline-offset-4"
                        onClick={() => {
                          setCategories([]);
                          setCategoriesError(null);
                          setCategoriesReloadKey((value) => value + 1);
                        }}
                      >
                        Riprova
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">
                    Sottocategoria (facoltativa)
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md disabled:bg-surface-container-low disabled:text-outline"
                    value={subcategoryKey}
                    onChange={(e) => setSubcategoryKey(e.target.value)}
                    disabled={!currentCategory || currentSubcategories.length === 0}
                  >
                    <option value="">
                      {!currentCategory
                        ? "Seleziona prima una categoria"
                        : currentSubcategories.length === 0
                          ? "Nessuna sottocategoria disponibile"
                          : "Seleziona una sottocategoria"}
                    </option>
                    {currentSubcategories.map((subcategory) => (
                      <option
                        key={subcategoryOptionValue(subcategory)}
                        value={subcategoryOptionValue(subcategory)}
                      >
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Minimo 8 caratteri"
              minLength={8}
              required
            />

            <label className="flex items-start gap-3 text-on-surface-variant">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <span className="font-body-md text-body-md leading-relaxed">
                Accetto i{" "}
                <span className="text-primary font-bold">Termini di Servizio</span> e la{" "}
                <span className="text-primary font-bold">Privacy Policy</span>.
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
              {loading
                ? "Creazione…"
                : `Registrati come ${role === "professional" ? "professionista" : "cliente"}`}
            </button>

            <div className="text-center text-on-surface-variant">
              Sei un professionista?{" "}
              <button
                type="button"
                className="text-primary font-bold hover:underline"
                onClick={() => setRole("professional")}
              >
                Crea un profilo tecnico
              </button>
            </div>
          </form>
        ) : (
          <form className="p-6 sm:p-8 space-y-5" onSubmit={onConfirmOtp}>
            <div>
              <h1 className="font-headline-md text-headline-md text-primary mb-1">
                Verifica la tua email
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Inserisci il codice ricevuto via email per completare l’accesso.
              </p>
            </div>

            {otpInfo ? (
              <div className="text-on-surface-variant bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-sm">
                {otpInfo}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Codice (OTP)
              </label>
              <input
                className="w-full px-4 py-4 tracking-[0.25em] text-center bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-lg text-body-lg"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-on-surface-variant">
                Il codice può essere lungo 6–10 cifre (dipende dalla configurazione Supabase).
              </p>
            </div>

            {otpError ? (
              <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                {otpError}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 bg-primary text-white font-button text-button py-4 rounded-full hover:bg-secondary transition-colors disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Verifica…" : "Conferma codice"}
              </button>
              <button
                className="flex-1 border-2 border-primary text-primary font-button text-button py-4 rounded-full hover:bg-surface-container-low transition-colors disabled:opacity-60"
                type="button"
                onClick={onResendOtp}
                disabled={loading || emailValue.length === 0}
              >
                Reinvia codice
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setOtpError(null);
                  setOtpInfo(null);
                }}
              >
                Modifica dati
              </button>
            </div>
          </form>
        )}
      </div>
  );
}
