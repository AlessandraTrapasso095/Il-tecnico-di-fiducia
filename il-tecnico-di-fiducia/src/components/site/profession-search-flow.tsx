"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES, type ItalianProvince } from "@/lib/locations/italian-provinces";
import {
  findProfessionCategory,
  mergeProfessionCategories,
  professionCategoryKey,
  professionSearchText,
  type DbProfessionCategory,
  type ProfessionCategory,
  type ProfessionSubcategory,
} from "@/lib/professions/taxonomy";

import { ProfessionCardIcon } from "./profession-card-icon";

type CategoriesResponse = { categories: DbProfessionCategory[] };
type ProvincesResponse = { provinces: ItalianProvince[] };

function isRenderableImage(url: string | null) {
  return Boolean(url && (url.startsWith("https://") || url.startsWith("/")));
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

  const [categories, setCategories] = useState<ProfessionCategory[]>(() =>
    mergeProfessionCategories([]),
  );
  const [provinces, setProvinces] = useState<ItalianProvince[]>(ITALIAN_PROVINCES);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [remote, setRemote] = useState(false);
  const [travel, setTravel] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadOptions() {
      const [categoriesResult, provincesResult] = await Promise.allSettled([
        fetchJson<CategoriesResponse>("/api/categories", { method: "GET" }),
        fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" }),
      ]);
      if (!alive) return;

      if (categoriesResult.status === "fulfilled") {
        setCategories(mergeProfessionCategories(categoriesResult.value.categories ?? []));
      }

      if (
        provincesResult.status === "fulfilled" &&
        Array.isArray(provincesResult.value.provinces) &&
        provincesResult.value.provinces.length > 0
      ) {
        setProvinces(provincesResult.value.provinces);
      }
    }

    void loadOptions();

    return () => {
      alive = false;
    };
  }, []);

  const visibleCategories = useMemo(
    () => (showAll ? categories : categories.slice(0, 6)),
    [categories, showAll],
  );

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
    <section id="professioni" className="py-20">
      <div className="text-center mb-12">
        <h2 className="font-headline-md text-headline-md text-primary mb-3">
          Sfoglia per professione
        </h2>
        <p className="text-on-surface-variant max-w-[680px] mx-auto">
          Scegli una categoria, aggiungi una specializzazione e filtra per zona o
          disponibilità.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleCategories.map((category) => {
          const selected = professionCategoryKey(category) === selectedCategoryKey;
          const hasImage = isRenderableImage(category.image_url);

          return (
            <button
              key={professionCategoryKey(category)}
              type="button"
              className={[
                "group relative h-[220px] overflow-hidden rounded-[26px] text-left shadow-[0_10px_32px_rgba(8,43,95,0.12)] sm:h-[230px]",
                "border border-white/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_42px_rgba(8,43,95,0.18)]",
                "focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/30",
                selected ? "ring-4 ring-on-tertiary-container" : "",
              ].join(" ")}
              onClick={() => selectCategory(category)}
            >
              {hasImage ? (
                <Image
                  src={category.image_url ?? ""}
                  alt={category.name}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${category.visualClass} transition-transform duration-500 group-hover:scale-105`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_22%,rgba(255,255,255,0.28),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.15),transparent)]" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#001b3e]/95 via-primary/55 to-primary/10" />
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.12)_0%,transparent_35%,rgba(255,255,255,0.08)_70%,transparent_100%)] opacity-80" />
              <div className="absolute right-5 top-5 flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/30 bg-white/15 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition-transform duration-300 group-hover:scale-105 sm:h-28 sm:w-28">
                <ProfessionCardIcon
                  name={category.icon}
                  className="h-16 w-16 drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:h-[74px] sm:w-[74px]"
                />
              </div>
              <div className="absolute bottom-5 left-5 right-5">
                <div className="inline-flex rounded-full bg-[#FF8500] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                  {selected ? "Selezionata" : "Professione"}
                </div>
                <div className="mt-3 font-headline-sm text-[25px] leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)] sm:text-[28px]">
                  {category.name}
                </div>
                <div className="mt-2 text-sm font-semibold text-primary-fixed-dim drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                  {category.subcategories[0]?.name ?? "Categoria professionale"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {categories.length > 6 ? (
        <div className="mt-10 text-center">
          <button
            type="button"
            className="inline-flex items-center justify-center font-button text-button border-2 border-primary text-primary px-8 py-3 rounded-full hover:bg-primary hover:text-white transition-colors"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "Mostra meno categorie"
              : `Visualizza tutte le categorie (${categories.length})`}
          </button>
        </div>
      ) : null}

      <div
        ref={formRef}
        id="ricerca-professionisti"
        className="mt-12 rounded-[32px] bg-surface-container-lowest p-5 sm:p-8 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30"
      >
        <div className="mb-6">
          <span className="font-label-md text-label-md uppercase tracking-widest text-on-tertiary-container">
            Ricerca guidata
          </span>
          <h3 className="mt-2 font-headline-sm text-headline-sm text-primary">
            Categoria → sottocategoria → località → modalità
          </h3>
          <p className="mt-2 text-on-surface-variant">
            La ricerca userà categorie, province e filtri reali già gestiti dall’area
            cliente.
          </p>
        </div>

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
