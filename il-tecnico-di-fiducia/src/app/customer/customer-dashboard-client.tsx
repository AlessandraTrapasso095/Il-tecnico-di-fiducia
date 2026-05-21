"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchJson } from "@/lib/api/fetch-json";

type CustomerProfileLite = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

type ProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

type ProfessionalsResponse = {
  page: number;
  page_size: number;
  total: number;
  professionals: ProfessionalRow[];
};

type Province = { code: string; name: string };
type Category = { id: number; name: string; slug: string; image_url: string | null };

type ProvincesResponse = { provinces: Province[] };
type CategoriesResponse = { categories: Category[] };

type ContactRequestStatus = "pending" | "accepted" | "rejected";

type ContactRequestRow = {
  id: string;
  professional_id: string;
  subject: string;
  status: ContactRequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    province_code: string | null;
    avatar_url: string | null;
    headline: string | null;
  } | null;
};

type ContactRequestsResponse = {
  page: number;
  page_size: number;
  total: number;
  requests: ContactRequestRow[];
};

type SavedProfessionalsResponse = { professionals: ProfessionalRow[] };

function fullName(p: { first_name: string; last_name: string } | null | undefined) {
  if (!p) return "Professionista";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Professionista";
}

function initials(firstName: string, lastName: string) {
  const a = (firstName ?? "").trim().slice(0, 1).toUpperCase();
  const b = (lastName ?? "").trim().slice(0, 1).toUpperCase();
  return `${a}${b}` || "U";
}

function statusLabel(status: ContactRequestStatus) {
  switch (status) {
    case "pending":
      return "In attesa";
    case "accepted":
      return "Accettata";
    case "rejected":
      return "Rifiutata";
    default:
      return status;
  }
}

function statusBadgeClass(status: ContactRequestStatus) {
  switch (status) {
    case "pending":
      return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
    case "accepted":
      return "bg-primary-fixed text-on-primary-fixed-variant";
    case "rejected":
      return "bg-error-container text-on-error-container";
    default:
      return "bg-surface-container-highest text-on-surface-variant";
  }
}

function sanitizeQuery(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 64);
}

type CustomerDashboardClientProps = {
  profile: CustomerProfileLite;
};

type ContactModalState = {
  open: boolean;
  professional: ProfessionalRow | null;
};

export default function CustomerDashboardClient({ profile }: CustomerDashboardClientProps) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [provinceCode, setProvinceCode] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [remote, setRemote] = useState(false);
  const [travel, setTravel] = useState(false);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [professionalsTotal, setProfessionalsTotal] = useState(0);
  const [professionalsLoading, setProfessionalsLoading] = useState(false);
  const [professionalsError, setProfessionalsError] = useState<string | null>(null);

  const [requests, setRequests] = useState<ContactRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedLoading, setSavedLoading] = useState(false);

  const [contactModal, setContactModal] = useState<ContactModalState>({
    open: false,
    professional: null,
  });
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactPrivacy, setContactPrivacy] = useState(false);
  const [contactFiles, setContactFiles] = useState<File[]>([]);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactDone, setContactDone] = useState<{ conversationId: string | null } | null>(
    null,
  );

  const searchDebounce = useRef<number | null>(null);

  const provinceNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    provinces.forEach((p) => m.set(p.code, p.name));
    return m;
  }, [provinces]);

  async function loadFilters() {
    try {
      const [prov, cat] = await Promise.all([
        fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" }),
        fetchJson<CategoriesResponse>("/api/categories", { method: "GET" }),
      ]);
      setProvinces(prov.provinces ?? []);
      setCategories(cat.categories ?? []);
    } catch {
      // optional: keep empty selects
    }
  }

  async function loadSaved() {
    setSavedLoading(true);
    try {
      const res = await fetchJson<SavedProfessionalsResponse>("/api/saved-professionals", {
        method: "GET",
      });
      setSavedIds(new Set((res.professionals ?? []).map((p) => p.id)));
    } catch {
      // ignore
    } finally {
      setSavedLoading(false);
    }
  }

  async function loadRequests() {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await fetchJson<ContactRequestsResponse>(
        "/api/contact-requests?page_size=5&page=1",
        { method: "GET" },
      );
      setRequests(res.requests ?? []);
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Errore imprevisto.");
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadProfessionals(next?: { page: number }) {
    const page = next?.page ?? 1;
    setProfessionalsLoading(true);
    setProfessionalsError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", "12");
    const qq = sanitizeQuery(q);
    if (qq) params.set("q", qq);
    if (provinceCode) params.set("province_code", provinceCode);
    if (categoryId) params.set("category_id", categoryId);
    if (remote) params.set("remote", "true");
    if (travel) params.set("travel", "true");

    try {
      const res = await fetchJson<ProfessionalsResponse>(`/api/professionals?${params}`, {
        method: "GET",
      });
      setProfessionals(res.professionals ?? []);
      setProfessionalsTotal(res.total ?? 0);
    } catch (e) {
      setProfessionalsError(e instanceof Error ? e.message : "Errore imprevisto.");
      setProfessionals([]);
      setProfessionalsTotal(0);
    } finally {
      setProfessionalsLoading(false);
    }
  }

  useEffect(() => {
    // Defer initial state hydration to avoid cascading renders warnings.
    const t = window.setTimeout(() => {
      void loadFilters();
      void loadSaved();
      void loadRequests();
      void loadProfessionals();
    }, 0);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search/filter changes.
  useEffect(() => {
    if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(() => {
      void loadProfessionals();
    }, 300);
    return () => {
      if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, provinceCode, categoryId, remote, travel]);

  async function toggleSaved(professionalId: string) {
    const isSaved = savedIds.has(professionalId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(professionalId);
      else next.add(professionalId);
      return next;
    });

    try {
      if (isSaved) {
        await fetchJson<{ ok: true }>(`/api/saved-professionals/${professionalId}`, {
          method: "DELETE",
        });
      } else {
        await fetchJson<{ ok: true }>("/api/saved-professionals", {
          method: "POST",
          body: JSON.stringify({ professional_id: professionalId }),
        });
      }
    } catch {
      // rollback best-effort
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(professionalId);
        else next.delete(professionalId);
        return next;
      });
    }
  }

  function openContact(pro: ProfessionalRow) {
    setContactModal({ open: true, professional: pro });
    setContactSubject("");
    setContactMessage("");
    setContactPrivacy(false);
    setContactFiles([]);
    setContactError(null);
    setContactDone(null);
  }

  async function sendContactRequest() {
    const pro = contactModal.professional;
    if (!pro) return;

    setContactSending(true);
    setContactError(null);
    try {
      const created = await fetchJson<{ request: { id: string }; conversation_id: string | null }>(
        "/api/contact-requests",
        {
          method: "POST",
          body: JSON.stringify({
            professional_id: pro.id,
            subject: contactSubject,
            message: contactMessage,
            privacy_accepted: contactPrivacy,
          }),
        },
      );

      if (contactFiles.length > 0) {
        const fd = new FormData();
        contactFiles.forEach((f) => fd.append("files", f));
        const res = await fetch(`/api/contact-requests/${created.request.id}/attachments`, {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
      }

      setContactDone({ conversationId: created.conversation_id });
      void loadRequests();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setContactSending(false);
    }
  }

  const heroBg =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBv9k5MXue40t0uC4k-4kR0tPcfh1qDN0zY0Pzw146xZfO9W9Uz4MPD78Dtq0Bl8HEBwhBJ3GuWfMlxScJHpspEUkMvDC29nEZtq5ZzFNccrKBJhx4kRGbP-CRXrS5oHrNTbhjD3XoL-_I7NjpFA3hvDPg8FPSgJlzikdv1xtDQAk-Itqe4PUmaSyoyiLzbtRzh9YmxMoCz56OgCcPEEVuR_BmEDf0rIU5v4KdbrZBesmpoxjHSR45NBwG9D4Wab_EJ5jePxuvwzJ_u";

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed top-0 w-full h-[100px] z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 max-w-[1280px] mx-auto h-full gap-3">
          <Link href="/customer" className="flex items-center gap-2 min-w-0">
            <span className="text-headline-sm font-headline-sm font-bold text-primary truncate">
              Il tecnico di fiducia
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/customer"
              className="font-label-md text-label-md text-on-tertiary-container font-bold border-b-2 border-on-tertiary-container pb-1"
            >
              Esplora
            </Link>
            <Link
              href="/#come-funziona"
              className="font-label-md text-label-md text-on-surface-variant hover:text-on-tertiary-container transition-colors"
            >
              Come funziona
            </Link>
            <a
              href="#richieste"
              className="font-label-md text-label-md text-on-surface-variant hover:text-on-tertiary-container transition-colors"
            >
              Richieste
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/messages"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
              title="Messaggi"
            >
              <span className="material-symbols-outlined" aria-hidden>
                chat
              </span>
            </Link>
            <SignOutButton
              className="p-2 text-error hover:bg-error-container/30 rounded-full transition-all"
              aria-label="Logout"
            >
              <span className="material-symbols-outlined" aria-hidden>
                logout
              </span>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="pt-[100px]">
        <section className="relative py-14 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <Image
              src={heroBg}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-10"
            />
          </div>
          <div className="relative z-10 max-w-[1280px] mx-auto text-center">
            <h1 className="font-headline-md text-headline-md text-primary mb-6">
              Ciao {profile.first_name}, di cosa hai bisogno oggi?
            </h1>

            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white/60 backdrop-blur-md border border-outline-variant/40 rounded-[9999px] overflow-hidden shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
                <div className="flex items-center gap-3 px-5 py-4 flex-1">
                  <span className="material-symbols-outlined text-outline" aria-hidden>
                    search
                  </span>
                  <input
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none font-body-md text-body-md placeholder:text-outline-variant"
                    placeholder="Elettricista, Idraulico, Architetto…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="bg-on-tertiary-container text-white px-10 py-4 font-button text-button hover:bg-[#FF9A2B] transition-colors"
                  onClick={() => void loadProfessionals()}
                >
                  Cerca
                </button>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-3 text-on-surface-variant">
                <label className="inline-flex items-center gap-2 bg-surface-container-lowest/70 border border-outline-variant/30 px-4 py-2 rounded-full">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                  />
                  <span className="text-sm">Disponibile remoto</span>
                </label>
                <label className="inline-flex items-center gap-2 bg-surface-container-lowest/70 border border-outline-variant/30 px-4 py-2 rounded-full">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                    checked={travel}
                    onChange={(e) => setTravel(e.target.checked)}
                  />
                  <span className="text-sm">Disponibile trasferte</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4 sm:px-6 max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-3 bg-surface-container-lowest rounded-[20px] p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
              <div className="font-headline-sm text-primary mb-4">Filtra ricerca</div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">
                    Categoria
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Tutte</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">
                    Provincia
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
                    value={provinceCode}
                    onChange={(e) => setProvinceCode(e.target.value)}
                  >
                    <option value="">Tutte</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="w-full bg-primary text-white rounded-full py-3 font-button text-button hover:bg-secondary transition-colors"
                  onClick={() => void loadProfessionals()}
                >
                  Applica filtri
                </button>

                <button
                  type="button"
                  className="w-full border-2 border-primary text-primary rounded-full py-3 font-button text-button hover:bg-primary/5 transition-colors"
                  onClick={() => {
                    setQ("");
                    setProvinceCode("");
                    setCategoryId("");
                    setRemote(false);
                    setTravel(false);
                    void loadProfessionals();
                  }}
                >
                  Reset
                </button>
              </div>
            </aside>

            <div className="lg:col-span-9">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <div className="font-headline-sm text-primary">Professionisti trovati</div>
                  <div className="text-on-surface-variant text-sm">
                    {professionalsLoading ? "Caricamento…" : `${professionalsTotal} risultati`}
                  </div>
                </div>
              </div>

              {professionalsError ? (
                <div className="mb-4 text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                  {professionalsError}
                </div>
              ) : null}

              {professionalsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-surface-container-lowest rounded-[20px] p-6 border border-outline-variant/30 shadow-sm animate-pulse"
                    >
                      <div className="h-4 w-2/3 bg-surface-container-high rounded mb-3" />
                      <div className="h-3 w-1/2 bg-surface-container-high rounded mb-6" />
                      <div className="h-10 w-full bg-surface-container-high rounded-full" />
                    </div>
                  ))}
                </div>
              ) : professionals.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-[20px] p-10 border border-outline-variant/30 text-center">
                  <div className="text-primary font-headline-sm mb-2">
                    Nessun professionista trovato
                  </div>
                  <div className="text-on-surface-variant">
                    Prova a modificare i filtri o la ricerca.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {professionals.map((p) => {
                    const isSaved = savedIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className="bg-surface-container-lowest rounded-[20px] p-6 border border-outline-variant/30 shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full border-2 border-primary-container overflow-hidden bg-surface-container-high flex items-center justify-center shrink-0">
                            {p.avatar_url ? (
                              <Image
                                className="object-cover"
                                alt={fullName(p)}
                                src={p.avatar_url}
                                width={56}
                                height={56}
                              />
                            ) : (
                              <span className="font-button text-primary">
                                {initials(p.first_name, p.last_name)}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-headline-sm text-primary leading-tight">
                              {fullName(p)}
                            </div>
                            <div className="text-on-surface-variant text-sm mt-1 line-clamp-2">
                              {p.headline ?? "—"}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {p.province_code ? (
                                <span className="px-3 py-1 rounded-full text-xs font-label-md bg-surface-container-low text-primary">
                                  {provinceNameByCode.get(p.province_code) ?? p.province_code}
                                </span>
                              ) : null}
                              {p.available_remote ? (
                                <span className="px-3 py-1 rounded-full text-xs font-label-md bg-primary-fixed text-on-primary-fixed">
                                  Remoto
                                </span>
                              ) : null}
                              {p.available_travel ? (
                                <span className="px-3 py-1 rounded-full text-xs font-label-md bg-secondary-fixed text-on-secondary-fixed">
                                  Trasferte
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={[
                              "w-11 h-11 rounded-full border transition-colors flex items-center justify-center shrink-0",
                              isSaved
                                ? "border-on-tertiary-container text-on-tertiary-container bg-on-tertiary-container/10"
                                : "border-outline-variant/50 text-primary hover:bg-surface-container-high",
                            ].join(" ")}
                            title={isSaved ? "Rimuovi dai salvati" : "Salva professionista"}
                            disabled={savedLoading}
                            onClick={() => void toggleSaved(p.id)}
                          >
                            <span className="material-symbols-outlined" aria-hidden>
                              {isSaved ? "favorite" : "favorite_border"}
                            </span>
                          </button>
                        </div>

                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            className="flex-1 bg-[#FF8500] text-white font-button text-button py-3 rounded-full hover:bg-[#FF9A2B] transition-colors active:scale-[0.99]"
                            onClick={() => openContact(p)}
                          >
                            Contatta
                          </button>
                          <Link
                            href="/messages"
                            className="flex-1 text-center border-2 border-primary text-primary font-button text-button py-3 rounded-full hover:bg-primary hover:text-white transition-colors"
                          >
                            Apri messaggi
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="richieste" className="py-12 px-4 sm:px-6 max-w-[1280px] mx-auto">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="font-headline-sm text-primary">Richieste recenti</div>
              <div className="text-on-surface-variant text-sm">
                {requestsLoading ? "Caricamento…" : "Le tue ultime richieste inviate"}
              </div>
            </div>
          </div>

          {requestsError ? (
            <div className="mb-4 text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
              {requestsError}
            </div>
          ) : null}

          {requestsLoading ? (
            <div className="bg-surface-container-lowest rounded-[20px] p-6 border border-outline-variant/30 shadow-sm animate-pulse">
              <div className="h-4 w-1/3 bg-surface-container-high rounded mb-3" />
              <div className="h-4 w-2/3 bg-surface-container-high rounded" />
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-[20px] p-10 border border-outline-variant/30 text-center">
              <div className="text-primary font-headline-sm mb-2">Ancora nessuna richiesta</div>
              <div className="text-on-surface-variant mb-6">
                Inizia cercando un professionista e inviando la tua prima richiesta.
              </div>
              <button
                type="button"
                className="bg-primary text-white px-8 py-3 rounded-full font-button text-button hover:bg-secondary transition-colors"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Crea la tua prima richiesta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface-container-lowest rounded-[20px] p-5 border border-outline-variant/30 shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-button text-primary truncate">
                        {fullName(r.participant)}
                      </div>
                      <div className="text-on-surface-variant text-sm truncate">
                        {r.subject}
                      </div>
                      <div className="mt-2">
                        <span
                          className={[
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            statusBadgeClass(r.status),
                          ].join(" ")}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </div>
                    </div>

                    {r.conversation_id ? (
                      <button
                        type="button"
                        className="shrink-0 font-button text-button border-2 border-primary text-primary px-4 py-2 rounded-full hover:bg-primary hover:text-white transition-colors"
                        onClick={() => {
                          router.push(`/messages?conversation=${encodeURIComponent(r.conversation_id!)}`);
                        }}
                      >
                        Apri chat
                      </button>
                    ) : (
                      <Link
                        href="/messages"
                        className="shrink-0 font-button text-button border-2 border-primary text-primary px-4 py-2 rounded-full hover:bg-primary hover:text-white transition-colors"
                      >
                        Messaggi
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {contactModal.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setContactModal({ open: false, professional: null })}
          />
          <div className="relative w-full max-w-[640px] bg-surface-container-lowest rounded-[24px] shadow-[0_12px_50px_rgba(0,0,0,0.20)] border border-white/20 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-headline-sm text-primary mb-1">
                  Invia una richiesta a {fullName(contactModal.professional)}
                </div>
                <div className="text-on-surface-variant text-sm">
                  Compila il modulo per aprire una conversazione.
                </div>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors"
                onClick={() => setContactModal({ open: false, professional: null })}
                aria-label="Chiudi"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {contactDone ? (
                <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4">
                  <div className="font-button text-primary mb-1">Richiesta inviata</div>
                  <div className="text-on-surface-variant text-sm">
                    Puoi continuare la conversazione nella sezione messaggi.
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      className="flex-1 bg-primary text-white rounded-full py-3 font-button text-button hover:bg-secondary transition-colors"
                      onClick={() => {
                        const cid = contactDone.conversationId;
                        setContactModal({ open: false, professional: null });
                        router.push(cid ? `/messages?conversation=${encodeURIComponent(cid)}` : "/messages");
                      }}
                    >
                      Vai alla chat
                    </button>
                    <button
                      type="button"
                      className="flex-1 border-2 border-primary text-primary rounded-full py-3 font-button text-button hover:bg-primary/5 transition-colors"
                      onClick={() => setContactModal({ open: false, professional: null })}
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Oggetto
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-[12px] border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all font-body-md"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Es. Rifacimento impianto elettrico"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Messaggio
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-[12px] border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all font-body-md resize-none"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Descrivi brevemente la tua necessità…"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Foto e video (opzionale, max 10)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                      onChange={(e) => setContactFiles(Array.from(e.target.files ?? []))}
                    />
                    {contactFiles.length > 0 ? (
                      <div className="text-xs text-on-surface-variant">
                        {contactFiles.length} file selezionati
                      </div>
                    ) : null}
                  </div>

                  <label className="flex items-start gap-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
                      checked={contactPrivacy}
                      onChange={(e) => setContactPrivacy(e.target.checked)}
                      required
                    />
                    <span className="text-sm text-on-surface-variant leading-relaxed">
                      Dichiaro di aver letto l’informativa privacy e acconsento al trattamento
                      dei dati per la gestione della richiesta.
                    </span>
                  </label>

                  {contactError ? (
                    <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                      {contactError}
                    </div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      className="flex-1 border-2 border-primary text-primary rounded-full py-3 font-button text-button hover:bg-primary/5 transition-colors"
                      onClick={() => setContactModal({ open: false, professional: null })}
                      disabled={contactSending}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="flex-1 bg-on-tertiary-container text-white rounded-full py-3 font-button text-button shadow-lg shadow-on-tertiary-container/20 hover:bg-[#FF9A2B] transition-colors disabled:opacity-60"
                      onClick={() => void sendContactRequest()}
                      disabled={contactSending}
                    >
                      {contactSending ? "Invio…" : "Invia richiesta"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
