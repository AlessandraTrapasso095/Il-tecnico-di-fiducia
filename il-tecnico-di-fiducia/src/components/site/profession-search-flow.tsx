"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";
import {
  ITALIAN_PROVINCES_BY_NAME,
  type ItalianProvince,
} from "@/lib/locations/italian-provinces";
import {
  CATEGORY_IMAGE_FALLBACK,
  findProfessionCategory,
  normalizeProfessionCategories,
  professionCategoryKey,
  professionSearchText,
  PROFESSION_CATEGORIES,
  type DbProfessionCategory,
  type ProfessionCategory,
  type ProfessionSubcategory,
} from "@/lib/professions/taxonomy";

import { ProfessionCardIcon } from "./profession-card-icon";

type CategoriesResponse = { categories: DbProfessionCategory[] };
type ProvincesResponse = { provinces: ItalianProvince[] };

function isRenderableImage(url: string | null): url is string {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    const allowedHosts = [
      "images.pexels.com",
      "lh3.googleusercontent.com",
      "weodeayzidjftyzxmzgb.supabase.co",
    ];
    return (
      parsed.protocol === "https:" &&
      allowedHosts.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function buildCustomerPath(input: {
  category: ProfessionCategory | null;
  subcategory: ProfessionSubcategory | null;
  provinceCode: string;
  remote: boolean;
  travel: boolean;
}) {
  const params = new URLSearchParams();
  const q = professionSearchText(input.category, input.subcategory);

  if (input.category?.id !== null && input.category?.id !== undefined) {
    params.set("category_id", String(input.category.id));
  }
  if (q) params.set("q", q);
  if (input.provinceCode) params.set("province_code", input.provinceCode);
  if (input.remote) params.set("remote", "true");
  if (input.travel) params.set("travel", "true");

  const queryString = params.toString();
  return `/customer${queryString ? `?${queryString}` : ""}`;
}

export function ProfessionSearchFlow() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [categories, setCategories] = useState<ProfessionCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [usingCategoryFallback, setUsingCategoryFallback] = useState(false);
  const [provinces, setProvinces] = useState<ItalianProvince[]>(ITALIAN_PROVINCES_BY_NAME);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [remote, setRemote] = useState(false);
  const [travel, setTravel] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadOptions() {
      const [categoriesResult, provincesResult] = await Promise.allSettled([
        fetchJson<CategoriesResponse>("/api/categories", { method: "GET" }),
        fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" }),
      ]);
      if (!alive) return;

      if (categoriesResult.status === "fulfilled") {
        setCategories(normalizeProfessionCategories(categoriesResult.value.categories ?? []));
        setUsingCategoryFallback(false);
      } else {
        setCategories(PROFESSION_CATEGORIES);
        setUsingCategoryFallback(true);
      }

      if (
        provincesResult.status === "fulfilled" &&
        Array.isArray(provincesResult.value.provinces) &&
        provincesResult.value.provinces.length > 0
      ) {
        setProvinces(provincesResult.value.provinces);
      }

      setCategoriesLoading(false);
    }

    void loadOptions();

    return () => {
      alive = false;
    };
  }, []);

  const currentCategory = findProfessionCategory(categories, selectedCategoryKey);
  const currentSubcategories = currentCategory?.subcategories ?? [];
  const currentSubcategory =
    currentSubcategories.find((subcategory) => subcategory.slug === selectedSubcategorySlug) ??
    null;
  const categoryLabel = currentCategory?.name ?? "";

  function selectCategory(nextCategory: ProfessionCategory) {
    setSelectedCategoryKey(professionCategoryKey(nextCategory));
    setSelectedSubcategorySlug("");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function changeCategory(nextKey: string) {
    setSelectedCategoryKey(nextKey);
    setSelectedSubcategorySlug("");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customerPath = buildCustomerPath({
      category: currentCategory,
      subcategory: currentSubcategory,
      provinceCode,
      remote,
      travel,
    });
    router.push(`/auth/login?next=${encodeURIComponent(customerPath)}`);
  }

  return (
    <section id="professioni" tabIndex={-1} className="scroll-mt-24 py-20 outline-none">
      <div className="text-center mb-12">
        <h2 className="font-headline-md text-headline-md text-primary mb-3">
          Sfoglia professioni
        </h2>
        <p className="text-on-surface-variant max-w-[680px] mx-auto">
          Scegli una categoria, aggiungi una specializzazione e filtra per zona o
          disponibilità.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
        {categoriesLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[168px] animate-pulse rounded-[22px] border border-outline-variant/30 bg-surface-container-low sm:h-[230px] sm:rounded-[26px]"
                aria-hidden
              />
            ))
          : null}

        {!categoriesLoading && categories.length === 0 ? (
          <div className="col-span-2 rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm md:col-span-3 xl:col-span-4">
            Nessuna professione disponibile al momento.
          </div>
        ) : null}

        {!categoriesLoading ? categories.map((category) => {
          const selected = professionCategoryKey(category) === selectedCategoryKey;
          const imageUrl = isRenderableImage(category.image_url)
            ? category.image_url
            : CATEGORY_IMAGE_FALLBACK;

          return (
            <button
              key={professionCategoryKey(category)}
              type="button"
              className={[
                "group relative h-[168px] overflow-hidden rounded-[22px] text-left shadow-[0_10px_32px_rgba(8,43,95,0.12)] sm:h-[230px] sm:rounded-[26px]",
                "border border-white/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_42px_rgba(8,43,95,0.18)]",
                "focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/30",
                selected ? "ring-4 ring-on-tertiary-container" : "",
              ].join(" ")}
              onClick={() => selectCategory(category)}
              aria-pressed={selected}
            >
              <Image
                src={imageUrl}
                alt={category.name}
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover saturate-[1.04] transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#001b3e]/95 via-[#001b3e]/48 to-[#001b3e]/12" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(120deg,rgba(255,255,255,0.08)_0%,transparent_36%,rgba(255,255,255,0.06)_74%,transparent_100%)]" />
              <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/28 bg-white/14 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition-transform duration-300 group-hover:scale-105 sm:right-4 sm:top-4 sm:h-12 sm:w-12 sm:rounded-[18px]">
                <ProfessionCardIcon
                  name={category.icon}
                  className="h-6 w-6 drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:h-7 sm:w-7"
                />
              </div>
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5">
                <div className="font-headline-sm text-[20px] leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)] [overflow-wrap:anywhere] sm:text-[30px]">
                  {category.name}
                </div>
              </div>
            </button>
          );
        }) : null}
      </div>

      {usingCategoryFallback ? (
        <p className="mt-5 text-center text-sm text-on-surface-variant">
          Catalogo temporaneamente caricato dal fallback locale.
        </p>
      ) : null}

      <div
        ref={formRef}
        id="ricerca-professionisti"
        className="mt-12 rounded-[32px] bg-surface-container-lowest p-5 sm:p-8 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30"
      >
        <form className="grid grid-cols-1 lg:grid-cols-12 gap-4" onSubmit={submitSearch}>
          <label className="lg:col-span-3 space-y-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Macro-categoria
            </span>
            <select
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
              value={selectedCategoryKey}
              onChange={(event) => changeCategory(event.target.value)}
            >
              <option value="">Tutte le categorie</option>
              {categories.map((category) => (
                <option key={professionCategoryKey(category)} value={professionCategoryKey(category)}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-3 space-y-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Sottocategoria
            </span>
            <select
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md disabled:bg-surface-container-low disabled:text-outline"
              value={selectedSubcategorySlug}
              onChange={(event) => setSelectedSubcategorySlug(event.target.value)}
              disabled={!currentCategory || currentSubcategories.length === 0}
            >
              <option value="">
                {currentCategory ? "Tutte le sottocategorie" : "Seleziona prima una categoria"}
              </option>
              {currentSubcategories.map((subcategory) => (
                <option key={subcategory.slug} value={subcategory.slug}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-3 space-y-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Provincia
            </span>
            <select
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
              value={provinceCode}
              onChange={(event) => setProvinceCode(event.target.value)}
            >
              <option value="">Tutte le province</option>
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>

          <div className="lg:col-span-3 flex flex-col gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Modalità
            </span>
            <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                checked={remote}
                onChange={(event) => setRemote(event.target.checked)}
              />
              <span className="font-body-md text-body-md">Da remoto</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                checked={travel}
                onChange={(event) => setTravel(event.target.checked)}
              />
              <span className="font-body-md text-body-md">In presenza / trasferte</span>
            </label>
          </div>

          <div className="lg:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-outline-variant/40 pt-5">
            <p className="text-sm text-on-surface-variant">
              {categoryLabel
                ? `Filtro selezionato: ${categoryLabel}${currentSubcategory ? ` · ${currentSubcategory.name}` : ""}`
                : "Puoi cercare anche senza selezionare una categoria."}
            </p>
            <button
              type="submit"
              className="w-full sm:w-auto bg-[#FF8500] text-white px-8 py-4 rounded-full font-button text-button hover:bg-[#FF9A2B] transition-all active:scale-[0.99] shadow-lg shadow-orange-500/20"
            >
              Mostra professionisti
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
