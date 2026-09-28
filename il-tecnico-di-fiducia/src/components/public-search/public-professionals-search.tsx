"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ContactAuthRequiredModal } from "@/components/auth/contact-auth-required-modal";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";

type Category = {
  id: string | number;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
};

type Subcategory = {
  id: string;
  category_id: string | number;
  name: string;
  slug: string;
};

type ProfessionalCardMedia = {
  id: string;
  post_id: string;
  public_url: string;
  media_type: "image" | "video";
  file_name: string | null;
};

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  search_summary: string | null;
  bio: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
  is_ctu: boolean;
  is_ctp: boolean;
  rating_average: number | null;
  reviews_count: number;
  work_media?: ProfessionalCardMedia[];
  categories?: Category[];
  subcategory?: Subcategory | null;
};

type ProfessionalsResponse = {
  page: number;
  page_size: number;
  total: number;
  professionals: Professional[];
};

type CategoriesResponse = {
  categories: Category[];
};

type GuestAuthPrompt = {
  loginHref: string;
  registerHref: string;
};

function fullName(person: Professional) {
  return (
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
    "Professionista"
  );
}

function professionalCategoryLabel(person: Professional) {
  if (person.subcategory?.name) return person.subcategory.name;

  if (person.categories?.length) {
    return person.categories.map((category) => category.name).join(" · ");
  }

  if (person.headline) return person.headline;

  return "Professionista";
}

const EMPTY_SEARCH_SUMMARY =
  "Questo professionista non ha ancora inserito la sua presentazione.";

function professionalCardExpandedSummary(person: Professional) {
  const searchSummary = person.search_summary?.trim();

  if (searchSummary) return searchSummary;

  return EMPTY_SEARCH_SUMMARY;
}

function professionalCardSummary(person: Professional) {
  const summary = professionalCardExpandedSummary(person);

  if (summary.length <= 140) return summary;

  return `${summary.slice(0, 137).trimEnd()}…`;
}

function ProfessionalCardSummaryText({
  summary,
  expandedSummary,
}: {
  summary: string;
  expandedSummary: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandable = expandedSummary.length > 140;
  const displayedSummary = expanded ? expandedSummary : summary;

  return (
    <div className="mt-4">
      <p
        className={[
          "text-sm leading-6 text-on-surface-variant",
          expanded ? "" : "line-clamp-3",
        ].join(" ")}
      >
        {displayedSummary}
      </p>

      {expandable ? (
        <button
          type="button"
          className="mt-1 text-sm font-bold text-primary transition hover:text-secondary"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Chiudi" : "Altro"}
        </button>
      ) : null}
    </div>
  );
}

function RatingStars({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  const value = average ?? 0;
  const rounded = Math.round(Math.min(5, Math.max(0, value)));

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[#FF8500]" aria-hidden>
        {"★".repeat(rounded)}
        <span className="text-outline-variant">{"★".repeat(5 - rounded)}</span>
      </span>

      <span className="text-on-surface-variant">
        {average !== null ? average.toFixed(1) : "—"} ({count})
      </span>
    </div>
  );
}

function ProfessionalResultMediaCarousel({
  professional,
}: {
  professional: Professional;
}) {
  const media = professional.work_media ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const safeActiveIndex =
    media.length === 0 ? 0 : Math.min(activeIndex, media.length - 1);

  const activeMedia = media[safeActiveIndex] ?? null;

  const showPrevious = useCallback(() => {
    if (media.length <= 1) return;

    setActiveIndex((current) =>
      current === 0 ? media.length - 1 : current - 1,
    );
  }, [media.length]);

  const showNext = useCallback(() => {
    if (media.length <= 1) return;

    setActiveIndex((current) =>
      current >= media.length - 1 ? 0 : current + 1,
    );
  }, [media.length]);

  useEffect(() => {
    if (media.length <= 1 || isPaused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) =>
        current >= media.length - 1 ? 0 : current + 1,
      );
    }, 2500);

    return () => window.clearInterval(interval);
  }, [isPaused, media.length]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    setIsPaused(true);
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;

    touchStartXRef.current = null;
    setIsPaused(false);

    if (startX === null || endX === null) return;

    const delta = endX - startX;

    if (Math.abs(delta) < 40) return;

    if (delta > 0) {
      showPrevious();
    } else {
      showNext();
    }
  }

  return (
    <div
      className="group/media relative aspect-[16/10] w-full touch-pan-y overflow-hidden bg-surface-container-high md:h-[230px] md:aspect-auto md:rounded-[18px] lg:h-[250px] lg:rounded-[20px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {activeMedia ? (
        activeMedia.media_type === "video" ? (
          <video
            key={activeMedia.id}
            src={activeMedia.public_url}
            controls
            muted
            playsInline
            preload="metadata"
            className="media-swap-fade h-full w-full object-cover"
            aria-label={`Lavoro di ${fullName(professional)}`}
          />
        ) : (
          <Image
            key={activeMedia.id}
            src={activeMedia.public_url}
            alt={
              activeMedia.file_name?.trim() ||
              `Lavoro di ${fullName(professional)}`
            }
            fill
            unoptimized
            sizes="(max-width: 767px) 100vw, 310px"
            className="media-swap-fade object-cover"
          />
        )
      ) : (
        <div className="flex h-full min-h-[230px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary-fixed via-surface-container-low to-secondary-fixed/40 px-8 text-center md:min-h-0">
          <span
            className="material-symbols-outlined text-[42px] text-primary/65"
            aria-hidden
          >
            photo_library
          </span>

          <div>
            <div className="font-button text-sm text-primary">
              Portfolio in aggiornamento
            </div>

            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Visita il profilo per scoprire attività, servizi e competenze.
            </p>
          </div>
        </div>
      )}

      {media.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Lavoro precedente"
            className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md backdrop-blur transition hover:bg-white md:size-8 md:opacity-0 md:group-hover/media:opacity-100 md:group-focus-within/media:opacity-100"
            onClick={showPrevious}
          >
            <span className="material-symbols-outlined" aria-hidden>
              chevron_left
            </span>
          </button>

          <button
            type="button"
            aria-label="Lavoro successivo"
            className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md backdrop-blur transition hover:bg-white md:size-8 md:opacity-0 md:group-hover/media:opacity-100 md:group-focus-within/media:opacity-100"
            onClick={showNext}
          >
            <span className="material-symbols-outlined" aria-hidden>
              chevron_right
            </span>
          </button>

          <div
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur"
            aria-label={`Media ${safeActiveIndex + 1} di ${media.length}`}
          >
            {media.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Vai al media ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={[
                  "size-1.5 rounded-full transition",
                  index === safeActiveIndex
                    ? "bg-white"
                    : "bg-white/45 hover:bg-white/70",
                ].join(" ")}
              />
            ))}
          </div>

          <span className="absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
            {safeActiveIndex + 1}/{media.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

function PublicSearchFilters({
  initialQuery,
  resultsLoading,
  onNavigate,
}: {
  initialQuery: string;
  resultsLoading: boolean;
  onNavigate: (path: string) => void;
}) {
  const initialParams = useMemo(
    () => new URLSearchParams(initialQuery),
    [initialQuery],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [q, setQ] = useState(() => initialParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState(
    () => initialParams.get("category_id") ?? "",
  );
  const [subcategoryId, setSubcategoryId] = useState(
    () => initialParams.get("subcategory_id") ?? "",
  );
  const [provinceCode, setProvinceCode] = useState(
    () => initialParams.get("province_code") ?? "",
  );
  const [remote, setRemote] = useState(
    () => initialParams.get("remote") === "true",
  );
  const [travel, setTravel] = useState(
    () => initialParams.get("travel") === "true",
  );
  const [isCtu, setIsCtu] = useState(
    () => initialParams.get("is_ctu") === "true",
  );
  const [isCtp, setIsCtp] = useState(
    () => initialParams.get("is_ctp") === "true",
  );
  const [submitting, setSubmitting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const result = await fetchJson<CategoriesResponse>("/api/categories", {
          method: "GET",
        });

        if (!alive) return;

        setCategories(result.categories ?? []);
      } catch (error) {
        if (!alive) return;

        setCategories([]);
        setCategoriesError(
          error instanceof Error
            ? error.message
            : "Non è stato possibile caricare le categorie.",
        );
      } finally {
        if (alive) {
          setCategoriesLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      alive = false;
    };
  }, []);

  const currentCategory =
    categories.find((category) => String(category.id) === categoryId) ?? null;

  const currentSubcategories = currentCategory?.subcategories ?? [];

  const activeFiltersCount = [
    q.replace(/\s+/g, " ").trim(),
    categoryId,
    subcategoryId,
    provinceCode,
    remote,
    travel,
    isCtu,
    isCtp,
  ].filter(Boolean).length;

  function submitFilters(event: React.FormEvent) {
    event.preventDefault();

    const params = new URLSearchParams();
    const normalizedQuery = q.replace(/\s+/g, " ").trim();

    if (normalizedQuery) params.set("q", normalizedQuery);
    if (categoryId) params.set("category_id", categoryId);
    if (subcategoryId) params.set("subcategory_id", subcategoryId);
    if (provinceCode) params.set("province_code", provinceCode);
    if (remote) params.set("remote", "true");
    if (travel) params.set("travel", "true");
    if (isCtu) params.set("is_ctu", "true");
    if (isCtp) params.set("is_ctp", "true");

    const query = params.toString();
    const nextPath = query ? `/cerca?${query}` : "/cerca";

    const currentParams = new URLSearchParams(initialQuery);
    currentParams.delete("page");

    const currentQuery = currentParams.toString();
    const currentPath = currentQuery ? `/cerca?${currentQuery}` : "/cerca";

    if (nextPath === currentPath) {
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    onNavigate(nextPath);
  }

  function resetFilters() {
    setQ("");
    setCategoryId("");
    setSubcategoryId("");
    setProvinceCode("");
    setRemote(false);
    setTravel(false);
    setIsCtu(false);
    setIsCtp(false);

    const currentParams = new URLSearchParams(initialQuery);
    currentParams.delete("page");

    if (currentParams.toString() === "") {
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    onNavigate("/cerca");
  }

  return (
    <section className="mb-6 overflow-hidden rounded-[22px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_6px_20px_rgba(8,43,95,0.05)]">
      <button
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="public-search-filters-panel"
        onClick={() => setFiltersOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-surface-container-low sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"
            aria-hidden
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </span>

          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-button text-sm text-primary sm:text-base">
                Filtri
              </span>

              {activeFiltersCount > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#FF8500] px-2 py-0.5 text-[11px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </span>

            <span className="mt-0.5 block truncate text-xs text-on-surface-variant sm:text-sm">
              {activeFiltersCount > 0
                ? "Modifica i filtri della ricerca"
                : "Affina i risultati della ricerca"}
            </span>
          </span>
        </span>

        <span
          className={[
            "material-symbols-outlined shrink-0 text-[24px] text-primary transition-transform duration-200",
            filtersOpen ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      <div
        id="public-search-filters-panel"
        className={[
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          filtersOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <form
            className="grid grid-cols-1 gap-4 border-t border-outline-variant/25 px-4 pb-5 pt-5 sm:grid-cols-2 sm:px-5 lg:grid-cols-12"
            onSubmit={submitFilters}
          >
            <label className="space-y-2 sm:col-span-2 lg:col-span-3">
              <span className="font-label-md text-sm text-on-surface-variant">
                Ricerca
              </span>

              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Es. ingegnere, geotecnico..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="space-y-2 lg:col-span-3">
              <span className="font-label-md text-sm text-on-surface-variant">
                Macro-categoria
              </span>

              <select
                value={categoryId}
                disabled={categoriesLoading}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSubcategoryId("");
                }}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">
                  {categoriesLoading ? "Caricamento…" : "Tutte le categorie"}
                </option>

                {categories.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 lg:col-span-3">
              <span className="font-label-md text-sm text-on-surface-variant">
                Sottocategoria
              </span>

              <select
                value={subcategoryId}
                disabled={!currentCategory || currentSubcategories.length === 0}
                onChange={(event) => setSubcategoryId(event.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-surface-container-low disabled:text-outline"
              >
                <option value="">
                  {currentCategory
                    ? "Tutte le sottocategorie"
                    : "Seleziona prima una categoria"}
                </option>

                {currentSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 lg:col-span-3">
              <span className="font-label-md text-sm text-on-surface-variant">
                Provincia
              </span>

              <select
                value={provinceCode}
                onChange={(event) => setProvinceCode(event.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
              >
                <option value="">Tutte le province</option>

                {ITALIAN_PROVINCES_BY_NAME.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="sm:col-span-2 lg:col-span-12">
              <div className="flex flex-wrap gap-2.5">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(event) => setRemote(event.target.checked)}
                    className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">Da remoto</span>
                </label>

                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={travel}
                    onChange={(event) => setTravel(event.target.checked)}
                    className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">Trasferte</span>
                </label>

                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={isCtu}
                    onChange={(event) => setIsCtu(event.target.checked)}
                    className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">CTU</span>
                </label>

                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={isCtp}
                    onChange={(event) => setIsCtp(event.target.checked)}
                    className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">CTP</span>
                </label>
              </div>
            </div>

            {categoriesError ? (
              <div
                role="alert"
                className="sm:col-span-2 lg:col-span-12 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container"
              >
                {categoriesError}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-outline-variant/30 pt-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end lg:col-span-12">
              <button
                type="button"
                onClick={resetFilters}
                disabled={submitting || resultsLoading}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary px-5 py-2.5 font-button text-sm text-primary transition hover:bg-primary-fixed disabled:cursor-wait disabled:opacity-60"
              >
                Azzera filtri
              </button>

              <button
                type="submit"
                disabled={submitting || resultsLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-7 py-2.5 font-button text-sm text-white shadow-md shadow-orange-500/15 transition hover:bg-[#FF9A2B] disabled:cursor-wait disabled:opacity-60"
              >
                {submitting || resultsLoading ? (
                  <>
                    <span
                      className="material-symbols-outlined animate-spin text-[19px]"
                      aria-hidden
                    >
                      progress_activity
                    </span>
                    Caricamento…
                  </>
                ) : (
                  "Cerca"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

const PUBLIC_SEARCH_PAGE_SIZE = 24;

export function PublicProfessionalsSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authPrompt, setAuthPrompt] = useState<GuestAuthPrompt | null>(null);

  const provinceNameByCode = useMemo(
    () =>
      new Map(
        ITALIAN_PROVINCES_BY_NAME.map((province) => [
          province.code,
          province.name,
        ]),
      ),
    [],
  );

  const apiQuery = searchParams.toString();
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(apiQuery);
        params.set("page", String(page));
        params.set("page_size", String(PUBLIC_SEARCH_PAGE_SIZE));

        const result = await fetchJson<ProfessionalsResponse>(
          `/api/professionals?${params.toString()}`,
          { method: "GET" },
        );

        if (!alive) return;

        setProfessionals(result.professionals ?? []);
        setTotal(result.total ?? 0);
      } catch (err) {
        if (!alive) return;

        setProfessionals([]);
        setTotal(0);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Non è stato possibile caricare i professionisti.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [apiQuery, page]);

  const totalPages = Math.max(1, Math.ceil(total / PUBLIC_SEARCH_PAGE_SIZE));

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    const params = new URLSearchParams(searchParams.toString());

    if (safePage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }

    const query = params.toString();

    router.push(query ? `/cerca?${query}` : "/cerca");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14"
      aria-busy={loading}
    >
      <div className="mb-8">
        <Link
          href="/#professioni"
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          ← Torna alla home
        </Link>

        <h1 className="font-headline-md text-headline-md text-primary">
          Professionisti trovati
        </h1>

        <p className="mt-2 text-on-surface-variant">
          {loading
            ? "Ricerca in corso…"
            : `${total} ${
                total === 1
                  ? "professionista disponibile"
                  : "professionisti disponibili"
              }`}
        </p>
      </div>

      <PublicSearchFilters
        key={[
          searchParams.get("q") ?? "",
          searchParams.get("category_id") ?? "",
          searchParams.get("subcategory_id") ?? "",
          searchParams.get("province_code") ?? "",
          searchParams.get("remote") ?? "",
          searchParams.get("travel") ?? "",
          searchParams.get("is_ctu") ?? "",
          searchParams.get("is_ctp") ?? "",
        ].join("|")}
        initialQuery={apiQuery}
        resultsLoading={loading}
        onNavigate={(path) => {
          router.push(path);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-[20px] border border-error/20 bg-error-container p-5 text-on-error-container"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-5">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm font-bold text-primary"
          >
            <span
              className="material-symbols-outlined animate-spin text-[19px]"
              aria-hidden
            >
              progress_activity
            </span>
            Ricerca in corso…
          </div>

          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="grid animate-pulse overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-sm md:grid-cols-[116px_minmax(0,1fr)_260px] lg:grid-cols-[128px_minmax(0,1fr)_310px]"
            >
              <div className="order-2 hidden p-5 md:order-1 md:block lg:p-6">
                <div className="mx-auto size-20 rounded-full bg-surface-container-high lg:size-24" />
              </div>

              <div className="order-3 space-y-4 p-5 md:order-2 lg:p-7">
                <div className="h-6 w-1/2 rounded bg-surface-container-high" />
                <div className="h-4 w-1/3 rounded bg-surface-container-high" />
                <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                <div className="h-16 w-full rounded-xl bg-surface-container-high" />
                <div className="h-11 w-72 max-w-full rounded-full bg-surface-container-high" />
              </div>

              <div className="order-1 aspect-[16/10] bg-surface-container-high md:order-3 md:aspect-auto md:h-[254px] lg:h-[282px]" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && professionals.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <span className="material-symbols-outlined" aria-hidden>
              search_off
            </span>
          </div>

          <div className="font-headline-sm text-headline-sm text-primary">
            Nessun professionista trovato
          </div>

          <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">
            Prova a modificare categoria, provincia o modalità di lavoro.
          </p>

          <Link
            href="/#professioni"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-3 font-button text-button text-white"
          >
            Modifica ricerca
          </Link>
        </div>
      ) : null}

      {!loading && !error && professionals.length > 0 ? (
        <div className="space-y-5">
          {professionals.map((professional) => {
            const profilePath = `/professionisti/${professional.id}`;
            const contactPath = `${profilePath}?action=contact`;
            const loginPath = `/auth/login?next=${encodeURIComponent(
              contactPath,
            )}`;
            const registerPath = `/auth/register?role=customer&next=${encodeURIComponent(
              contactPath,
            )}`;

            const summary = professionalCardSummary(professional);
            const expandedSummary =
              professionalCardExpandedSummary(professional);

            return (
              <article
                key={professional.id}
                data-professional-result-card
                className="group overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_8px_28px_rgba(8,43,95,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(8,43,95,0.13)]"
              >
                <div className="grid grid-cols-1 md:grid-cols-[116px_minmax(0,1fr)_260px] lg:grid-cols-[128px_minmax(0,1fr)_310px]">
                  <div className="order-3 hidden border-r border-outline-variant/20 px-4 py-5 md:order-1 md:flex md:items-start md:justify-center lg:px-5">
                    <ProfileAvatar
                      person={professional}
                      alt={fullName(professional)}
                      size="xl"
                      className="scale-110 border-2 border-primary-fixed bg-surface-container-high text-primary shadow-sm lg:scale-125"
                      fallbackClassName="font-button"
                    />
                  </div>

                  <div className="order-2 flex min-w-0 flex-col p-5 sm:p-6 md:order-2 md:px-5 md:py-5 lg:px-6">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-headline-sm text-[24px] leading-tight text-primary sm:text-[27px] md:text-[23px] lg:text-[25px]">
                          {fullName(professional)}
                        </h3>

                        <p className="mt-1 text-sm font-semibold leading-5 text-on-surface-variant">
                          {professionalCategoryLabel(professional)}
                        </p>

                        <div className="mt-3">
                          <RatingStars
                            average={professional.rating_average}
                            count={professional.reviews_count}
                          />
                        </div>
                      </div>

                      <ProfileAvatar
                        person={professional}
                        alt={fullName(professional)}
                        size="lg"
                        className="shrink-0 scale-110 border-2 border-primary-fixed bg-surface-container-high text-primary shadow-sm md:hidden"
                        fallbackClassName="font-button"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {professional.province_code ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-[11px] font-bold text-primary">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            aria-hidden
                          >
                            location_on
                          </span>
                          {provinceNameByCode.get(professional.province_code) ??
                            professional.province_code}
                        </span>
                      ) : null}

                      {professional.available_remote ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed-variant">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            aria-hidden
                          >
                            language
                          </span>
                          Remoto
                        </span>
                      ) : null}

                      {professional.available_travel ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-2.5 py-1 text-[11px] font-bold text-on-secondary-fixed">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            aria-hidden
                          >
                            commute
                          </span>
                          Trasferte
                        </span>
                      ) : null}

                      {professional.is_ctu ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed-variant">
                          CTU
                        </span>
                      ) : null}

                      {professional.is_ctp ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed-variant">
                          CTP
                        </span>
                      ) : null}
                    </div>

                    <ProfessionalCardSummaryText
                      summary={summary}
                      expandedSummary={expandedSummary}
                    />

                    <div className="mt-auto pt-5">
                      <div className="flex gap-3">
                        <Link
                          href={profilePath}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-center font-button text-sm text-white shadow-sm transition hover:bg-secondary md:max-w-[170px]"
                        >
                          <span
                            className="material-symbols-outlined text-[19px]"
                            aria-hidden
                          >
                            person
                          </span>
                          Vedi profilo
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setAuthPrompt({
                              loginHref: loginPath,
                              registerHref: registerPath,
                            })
                          }
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-4 py-2.5 text-center font-button text-sm text-white shadow-md shadow-orange-500/15 transition hover:bg-[#FF9A2B] active:scale-[0.99] md:max-w-[170px]"
                        >
                          <span
                            className="material-symbols-outlined text-[19px]"
                            aria-hidden
                          >
                            chat
                          </span>
                          Contatta
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="order-1 md:order-3 md:p-3 md:pl-0 lg:p-4 lg:pl-0">
                    <ProfessionalResultMediaCarousel
                      professional={professional}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && totalPages > 1 ? (
        <nav
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          aria-label="Paginazione professionisti"
        >
          <button
            type="button"
            className="min-h-11 rounded-full border-2 border-primary px-5 py-2 font-button text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Precedente
          </button>

          <span className="px-2 text-sm font-bold text-on-surface-variant">
            Pagina {page} di {totalPages}
          </span>

          <button
            type="button"
            className="min-h-11 rounded-full bg-primary px-5 py-2 font-button text-white transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Successiva
          </button>
        </nav>
      ) : null}
      <ContactAuthRequiredModal
        open={authPrompt !== null}
        onClose={() => setAuthPrompt(null)}
        loginHref={authPrompt?.loginHref ?? "/auth/login"}
        registerHref={
          authPrompt?.registerHref ?? "/auth/register?role=customer"
        }
      />
    </div>
  );
}
