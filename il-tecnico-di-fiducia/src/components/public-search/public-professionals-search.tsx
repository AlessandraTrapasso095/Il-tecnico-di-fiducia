"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";

type Category = {
  id: string | number;
  name: string;
  slug: string;
};

type Subcategory = {
  id: string;
  category_id: string | number;
  name: string;
  slug: string;
};

type Professional = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  bio: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
  is_ctu: boolean;
  is_ctp: boolean;
  rating_average: number | null;
  reviews_count: number;
  categories?: Category[];
  subcategory?: Subcategory | null;
};

type ProfessionalsResponse = {
  page: number;
  page_size: number;
  total: number;
  professionals: Professional[];
};

function fullName(person: Professional) {
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Professionista";
}

function categoryLabel(person: Professional) {
  if (person.subcategory?.name) return person.subcategory.name;
  if (person.categories?.length) {
    return person.categories.map((category) => category.name).join(" · ");
  }
  if (person.headline) return person.headline;
  return "Professionista";
}

function RatingStars({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  const value = average ?? 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[#FF8500]" aria-hidden>
        {"★".repeat(Math.round(Math.min(5, Math.max(0, value))))}
        <span className="text-outline-variant">
          {"★".repeat(5 - Math.round(Math.min(5, Math.max(0, value))))}
        </span>
      </span>
      <span className="text-on-surface-variant">
        {average !== null ? average.toFixed(1) : "—"} ({count})
      </span>
    </div>
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
  const page =
    Number.isInteger(rawPage) && rawPage > 0
      ? rawPage
      : 1;

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

  const totalPages = Math.max(
    1,
    Math.ceil(total / PUBLIC_SEARCH_PAGE_SIZE),
  );


  function goToPage(nextPage: number) {
    const safePage = Math.min(
      Math.max(1, nextPage),
      totalPages,
    );

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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <Link
          href="/#professioni"
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          ← Modifica ricerca
        </Link>

        <h1 className="font-headline-md text-headline-md text-primary">
          Professionisti trovati
        </h1>

        <p className="mt-2 text-on-surface-variant">
          {loading
            ? "Ricerca in corso..."
            : `${total} ${total === 1 ? "professionista disponibile" : "professionisti disponibili"}`}
        </p>
      </div>

      {error ? (
        <div className="rounded-[20px] border border-error/20 bg-error-container p-5 text-on-error-container">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[300px] animate-pulse rounded-[28px] border border-outline-variant/30 bg-surface-container-low"
            />
          ))}
        </div>
      ) : null}

      {!loading && !error && professionals.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
          <div className="font-headline-sm text-headline-sm text-primary">
            Nessun professionista trovato
          </div>
          <p className="mt-2 text-on-surface-variant">
            Prova a modificare categoria, provincia o modalità di lavoro.
          </p>
          <Link
            href="/#professioni"
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-button text-button text-white"
          >
            Modifica ricerca
          </Link>
        </div>
      ) : null}

      {!loading && !error && professionals.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {professionals.map((professional) => {
            const profilePath = `/professionisti/${professional.id}`;
            const contactPath = `${profilePath}?action=contact`;
            const loginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;

            return (
              <article
                key={professional.id}
                className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_10px_30px_rgba(8,43,95,0.08)]"
              >
                <div className="flex gap-4">
                  <ProfileAvatar
                    person={professional}
                    alt={fullName(professional)}
                    size="xl"
                    className="border-2 border-primary-fixed bg-surface-container-high text-primary"
                    fallbackClassName="font-button"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="font-headline-sm text-[24px] leading-tight text-primary">
                      {fullName(professional)}
                    </div>

                    <div className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                      {categoryLabel(professional)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {professional.is_ctu || professional.is_ctp ? (
                        <>
                          {professional.is_ctu ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant">
                              <span className="material-symbols-outlined text-[14px]">
                                verified
                              </span>
                              CTU
                            </span>
                          ) : null}

                          {professional.is_ctp ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant">
                              <span className="material-symbols-outlined text-[14px]">
                                verified
                              </span>
                              CTP
                            </span>
                          ) : null}
                        </>
                      ) : null}

                      {professional.province_code ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-primary">
                          {provinceNameByCode.get(professional.province_code) ??
                            professional.province_code}
                        </span>
                      ) : null}

                      {professional.available_remote ? (
                        <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed">
                          Remoto
                        </span>
                      ) : null}

                      {professional.available_travel ? (
                        <span className="rounded-full bg-secondary-fixed px-3 py-1 text-xs font-bold text-on-secondary-fixed">
                          Trasferte
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {professional.bio ? (
                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-on-surface-variant">
                    {professional.bio}
                  </p>
                ) : null}

                <div className="mt-5">
                  <RatingStars
                    average={professional.rating_average}
                    count={professional.reviews_count}
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={loginPath}
                    className="flex-1 rounded-full bg-[#FF8500] py-3 text-center font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
                  >
                    Contatta
                  </Link>

                  <Link
                    href={profilePath}
                    className="flex-1 rounded-full border-2 border-primary py-3 text-center font-button text-button text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    Vedi profilo
                  </Link>
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
    </div>
  );
}
