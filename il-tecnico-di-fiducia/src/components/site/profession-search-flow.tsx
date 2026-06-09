"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
};

type Province = {
  code: string;
  name: string;
};

type CategoriesResponse = { categories: Category[] };
type ProvincesResponse = { provinces: Province[] };

const categoryImageBySlug: Record<string, string> = {
  architetti:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCemy7B9P1kpymYEeupmx-XbZJbor21lsR3jFt0_2O7LDdqTipkZj9HclMYQXbIf4EfDK3ZjzjlWMhoBy4v3s58dSSf84zDT6k_CteC29vdcmSihTjOgt0SlsdiRaomsvxuVx8wlcxpYK2UUrXSZSUL72A4XmJToxUa9BHiRK24fjI5IM3sgqVU6BvpsReK9Sdl0Px18LhmT3-SPjEzv4xRVPoHsHt2a0iPJKq7T6nMsDQXi51M67xvk0GzJZ-PfaI2k3wvOujvYL6N",
  avvocati:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCpGguOIk8O9WjodNTRAptgdt5rbPdYg3BtA0ZgQ4KIjLPjI6eRlQO2jMlgnvj2ROIC6lx7LObwLac8BKaqBhjlc6UIxwGiSoZrVRfK69BZvUXUyLgGoACuFwmA9XLwKyNuscNkLMuUpsyh2fMWh6sy1OS6PkgpIll-QCsLiH3txOC9iG9mnEgb7l2H6BkDhQePlBqa4xROLfcpv-YaGBDMc3J5_rB1VY2YzOshgFAd1_x2K_h_g16uDVss5Uu_RQlkdl9NGAvyF2Do",
  elettricisti:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQpvXQFlipYZ48NEsT-LZTRmvyOBOHiT2ebEU7F4uwGA-83zTRC5t1RPGYtAMbxUFxkpdkiIvIBFs9WgwiMYxturHn2w2os0sVZPtG8ZlXLJv_zJHXeD3w9iA4H95VazOu-XaBenq4EaKtYqINoMtenPz2g0IEwx9wZ3Nj92ho-vFKnlbdtT_eqzd-rO-NAvGRINmeHwousj4xkHtHNbnJBQVtEw7y1RrfJJWSlNJHo8ay0JzD1qC1j0BZ6umhOGA6DDnRzqhj1_-f",
  geometri:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCZjyAQrIYj9PpsLD914K3jCPsLWpvMEPfmR1DQm3cPuyzEi_e5YHYGDw9aY-mrabNjatIFzRTSD_yd02P2R_Sz26ensYbVkMIMXGbSn1LW9hNWy5fFHoiaIcMKarFyw604xQnP9NPfmpDA12FOLJmHKGmqT4Vc-Mbcrd4hnMFfMVV9mdsTGxUmgDbO_sllDG9HUso9vcBGhUQmsVMIEtv9nhG8NvZhBdOg6COtR_a37Yq8fyDyheKVzUILyWvF8b9ZZDDrvCUNM4_B",
  informatici:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA0BRkP_kdLM5gmqNvA3ASa1eldNmGn217TsvbodTyYavS_zfg3ew2nMjLelsX4dZSAF5jDUOfttdhf6BtGMhVR13EoYshrJGSAmNeyRuboZaEEuEuFNyhnBoVMaRbWbanQr6mQG0HdfZxKmKeQS5FGprM89I3DvN2yAqZZATWRqUlsu9k8vkep6p36OVFp-Y3rlKRWwYoDdfHBl-PDnXt6PnXycSzDIh0ppOt87HJLYsykmPBS80ilw-liWpJ236AG6aNZNq0ozlWk",
  ingegneri:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQq5eVwBnqFjCnN86gkFsD--RbpO8N_s6_TA8GUajyTqu6oCUaTiaYakGsIYitF-97_Uk2reoVX4o7Ng4T_MF88_bowkzm2cg9PS1J9iUrkKtX5eac3wL1W3xOqfUOopiVVwkf6Qys-QdMbxn0ya-kAXqG0hC5lqML96RMdvJwDkTcYRgEonQLxHro7pPizfQQbBcjo7XdkzM9baEGOBg3XOQ-oonbtWb9NJgHQjYmrdTpoSzSG9L5dPuzaczVjqWXc_OKVZUFfqfx",
};

const fallbackCategoryImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD3vz0vv7le_BC8pwC5ChG1JFlJb6EZ85a2dEQ3fuRyjmE4_pzrok1vloTwAuPEqFpe_RJtW_iIz0vB1I2_2G0-zA1jn661rbqCxbYEHXa8pdJEmzixnBdNcnntVaj6JqxkoxVuVAX3Ply4XQwFwv0OXNenJHTfaQ-0WHWtQtqwWSf2DXdYrahUqwjUEGL2BVRlVRYmWnbPa7TgdNMQwQPjf8nwiDcapnqLqUc5g9RavELG8dmFJJ0VB6JXgYpYDrvsodGkkCMkyrsn";

function safeImageUrl(category: Category) {
  if (
    category.image_url &&
    (category.image_url.startsWith("https://") || category.image_url.startsWith("/"))
  ) {
    return category.image_url;
  }
  return categoryImageBySlug[category.slug] || fallbackCategoryImage;
}

function selectedCategoryLabel(categories: Category[], categoryId: string) {
  return categories.find((category) => String(category.id) === categoryId)?.name ?? "";
}

function buildCustomerPath(input: {
  categoryId: string;
  query: string;
  provinceCode: string;
  remote: boolean;
  travel: boolean;
}) {
  const params = new URLSearchParams();
  const q = input.query.replace(/\s+/g, " ").trim().slice(0, 64);
  if (input.categoryId) params.set("category_id", input.categoryId);
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [remote, setRemote] = useState(false);
  const [travel, setTravel] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadOptions() {
      setLoading(true);
      setError(null);
      try {
        const [categoriesRes, provincesRes] = await Promise.all([
          fetchJson<CategoriesResponse>("/api/categories", { method: "GET" }),
          fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" }),
        ]);
        if (!alive) return;
        setCategories(categoriesRes.categories ?? []);
        setProvinces(provincesRes.provinces ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Impossibile caricare le categorie.");
      } finally {
        if (alive) setLoading(false);
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

  const categoryLabel = selectedCategoryLabel(categories, categoryId);

  function selectCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customerPath = buildCustomerPath({
      categoryId,
      query,
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

      {error ? (
        <div className="rounded-[20px] border border-error/20 bg-error-container p-5 text-on-error-container text-center">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[260px] rounded-[26px] bg-surface-container-low animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-[32px] border-2 border-dashed border-outline-variant bg-surface-container-low p-10 text-center">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
            Nessuna categoria disponibile
          </h3>
          <p className="text-on-surface-variant">
            Le categorie appariranno qui appena saranno configurate nel database.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCategories.map((category) => {
              const selected = String(category.id) === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={[
                    "group relative h-[260px] rounded-[26px] overflow-hidden shadow-md text-left",
                    "focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/30",
                    selected ? "ring-4 ring-on-tertiary-container" : "",
                  ].join(" ")}
                  onClick={() => selectCategory(String(category.id))}
                >
                  <Image
                    src={safeImageUrl(category)}
                    alt={category.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/25 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="font-headline-sm text-headline-sm text-white">
                      {category.name}
                    </div>
                    <div className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
                      {selected ? "Selezionata" : "Scegli categoria"}
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
        </>
      )}

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
            La ricerca userà solo filtri reali già gestiti dall’area cliente.
          </p>
        </div>

        <form className="grid grid-cols-1 lg:grid-cols-12 gap-4" onSubmit={submitSearch}>
          <label className="lg:col-span-3 space-y-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Categoria
            </span>
            <select
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Tutte le categorie</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-3 space-y-2">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Sottocategoria o parola chiave
            </span>
            <input
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-body-md text-body-md"
              placeholder="Es. impianti, CILA, certificazioni…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
                ? `Categoria selezionata: ${categoryLabel}`
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
