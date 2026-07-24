"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type CategoryId = string | number;

type ManagedSubcategory = {
  id: string;
  category_id: CategoryId;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ManagedCategory = {
  id: CategoryId;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subcategories: ManagedSubcategory[];
};

type CategoriesResponse = {
  categories: ManagedCategory[];
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

type SubcategoryForm = {
  name: string;
  slug: string;
  sort_order: string;
  is_active: boolean;
};

function emptyCategoryForm(): CategoryForm {
  return {
    name: "",
    slug: "",
    description: "",
    image_url: "",
    icon: "",
    sort_order: "0",
    is_active: true,
  };
}

function emptySubcategoryForm(): SubcategoryForm {
  return {
    name: "",
    slug: "",
    sort_order: "0",
    is_active: true,
  };
}

function categoryFormFrom(category: ManagedCategory): CategoryForm {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    image_url: category.image_url ?? "",
    icon: category.icon ?? "",
    sort_order: String(category.sort_order),
    is_active: category.is_active,
  };
}

function subcategoryFormFrom(subcategory: ManagedSubcategory): SubcategoryForm {
  return {
    name: subcategory.name,
    slug: subcategory.slug,
    sort_order: String(subcategory.sort_order),
    is_active: subcategory.is_active,
  };
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isPreviewableImage(url: string) {
  return url.startsWith("https://") || url.startsWith("/");
}

function fullId(id: CategoryId) {
  return String(id);
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-surface-container-high text-on-surface-variant",
      ].join(" ")}
    >
      {active ? "Attiva" : "Inattiva"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "url";
}) {
  return (
    <label className="space-y-2">
      <span className="font-label-md text-sm text-on-surface-variant">{label}</span>
      <input
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function AdminCategoriesClient() {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [subcategoryForm, setSubcategoryForm] =
    useState<SubcategoryForm>(emptySubcategoryForm);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (first, second) =>
          first.sort_order - second.sort_order || first.name.localeCompare(second.name, "it"),
      ),
    [categories],
  );

  const expandedCategory = sortedCategories.find(
    (category) => fullId(category.id) === expandedCategoryId,
  );

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CategoriesResponse>("/api/admin/categories", {
        method: "GET",
      });
      setCategories(response.categories ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Non è stato possibile caricare le categorie.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadCategories]);

  function startCreateCategory() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm());
    setMessage(null);
    setError(null);
  }

  function startEditCategory(category: ManagedCategory) {
    setEditingCategoryId(fullId(category.id));
    setCategoryForm(categoryFormFrom(category));
    setExpandedCategoryId(fullId(category.id));
    setMessage(null);
    setError(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload = {
      ...categoryForm,
      slug: normalizeSlug(categoryForm.slug || categoryForm.name),
      sort_order: Number.parseInt(categoryForm.sort_order, 10),
      description: categoryForm.description || null,
      image_url: categoryForm.image_url || null,
      icon: categoryForm.icon || null,
    };

    try {
      if (editingCategoryId) {
        await fetchJson(`/api/admin/categories/${encodeURIComponent(editingCategoryId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Categoria aggiornata.");
      } else {
        await fetchJson("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Categoria creata.");
        setCategoryForm(emptyCategoryForm());
      }
      await loadCategories();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Non è stato possibile salvare la categoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: ManagedCategory) {
    const nextActive = !category.is_active;
    if (
      !nextActive &&
      !window.confirm(
        "Disattivare questa categoria? Non sarà visibile pubblicamente, ma potrà essere riattivata.",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/categories/${encodeURIComponent(fullId(category.id))}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...categoryFormFrom(category),
          is_active: nextActive,
        }),
      });
      setMessage(nextActive ? "Categoria riattivata." : "Categoria disattivata.");
      await loadCategories();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Non è stato possibile aggiornare lo stato della categoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startCreateSubcategory(category: ManagedCategory) {
    setExpandedCategoryId(fullId(category.id));
    setEditingSubcategoryId(null);
    setSubcategoryForm(emptySubcategoryForm());
    setMessage(null);
    setError(null);
  }

  function startEditSubcategory(category: ManagedCategory, subcategory: ManagedSubcategory) {
    setExpandedCategoryId(fullId(category.id));
    setEditingSubcategoryId(subcategory.id);
    setSubcategoryForm(subcategoryFormFrom(subcategory));
    setMessage(null);
    setError(null);
  }

  async function saveSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!expandedCategory) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload = {
      ...subcategoryForm,
      slug: normalizeSlug(subcategoryForm.slug || subcategoryForm.name),
      sort_order: Number.parseInt(subcategoryForm.sort_order, 10),
    };

    try {
      if (editingSubcategoryId) {
        await fetchJson(`/api/admin/subcategories/${encodeURIComponent(editingSubcategoryId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Sottocategoria aggiornata.");
      } else {
        await fetchJson(
          `/api/admin/categories/${encodeURIComponent(fullId(expandedCategory.id))}/subcategories`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        setMessage("Sottocategoria creata.");
        setSubcategoryForm(emptySubcategoryForm());
      }
      await loadCategories();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Non è stato possibile salvare la sottocategoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubcategory(subcategory: ManagedSubcategory) {
    const nextActive = !subcategory.is_active;
    if (
      !nextActive &&
      !window.confirm(
        "Disattivare questa sottocategoria? Non sarà visibile pubblicamente, ma potrà essere riattivata.",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/subcategories/${encodeURIComponent(subcategory.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...subcategoryFormFrom(subcategory),
          is_active: nextActive,
        }),
      });
      setMessage(nextActive ? "Sottocategoria riattivata." : "Sottocategoria disattivata.");
      await loadCategories();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Non è stato possibile aggiornare lo stato della sottocategoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="min-w-0 rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-headline-sm text-[26px] text-primary">
              Catalogo categorie
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Gestisci categorie e sottocategorie senza alterare i profili esistenti.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 font-button text-white transition hover:bg-primary/90"
            onClick={startCreateCategory}
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nuova categoria
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl bg-surface-container-low p-5 text-on-surface-variant">
            Caricamento categorie…
          </div>
        ) : null}

        {!loading && sortedCategories.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-surface-container-low p-5 text-on-surface-variant">
            Nessuna categoria configurata. Esegui il seed o crea una nuova categoria.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {sortedCategories.map((category) => {
            const expanded = fullId(category.id) === expandedCategoryId;
            return (
              <article
                key={fullId(category.id)}
                className={[
                  "rounded-3xl border p-4 transition",
                  expanded
                    ? "border-primary/40 bg-primary-fixed/30"
                    : "border-outline-variant/30 bg-white",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => setExpandedCategoryId(fullId(category.id))}
                  >
                    {category.image_url && isPreviewableImage(category.image_url) ? (
                      <span
                        className="h-14 w-14 shrink-0 rounded-2xl bg-cover bg-center"
                        style={{ backgroundImage: `url("${category.image_url}")` }}
                        aria-hidden
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                        <span className="material-symbols-outlined">
                          {category.icon || "category"}
                        </span>
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-[22px] text-primary">
                          {category.name}
                        </span>
                        <StatusPill active={category.is_active} />
                      </span>
                      <span className="mt-1 block break-all text-sm text-on-surface-variant">
                        slug: {category.slug} · ordine: {category.sort_order}
                      </span>
                      <span className="mt-2 block text-sm text-on-surface-variant">
                        {category.subcategories.length} sottocategorie
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container-high"
                      onClick={() => startEditCategory(category)}
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container-high"
                      onClick={() => startCreateSubcategory(category)}
                    >
                      Sottocategoria
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
                      disabled={saving}
                      onClick={() => void toggleCategory(category)}
                    >
                      {category.is_active ? "Disattiva" : "Riattiva"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
        <form
          className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6"
          onSubmit={saveCategory}
        >
          <h2 className="font-headline-sm text-[24px] text-primary">
            {editingCategoryId ? "Modifica categoria" : "Nuova categoria"}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Lo slug delle categorie già usate dal catalogo pubblico viene bloccato per sicurezza.
          </p>
          <div className="mt-5 space-y-4">
            <Field
              label="Nome"
              value={categoryForm.name}
              onChange={(value) => setCategoryForm((current) => ({ ...current, name: value }))}
            />
            <Field
              label="Slug"
              value={categoryForm.slug}
              onChange={(value) =>
                setCategoryForm((current) => ({ ...current, slug: normalizeSlug(value) }))
              }
              placeholder="es. ingegneri"
            />
            <label className="space-y-2">
              <span className="font-label-md text-sm text-on-surface-variant">
                Descrizione
              </span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <Field
              label="URL immagine"
              value={categoryForm.image_url}
              onChange={(value) =>
                setCategoryForm((current) => ({ ...current, image_url: value }))
              }
              type="url"
              placeholder="https://…"
            />
            {categoryForm.image_url && isPreviewableImage(categoryForm.image_url) ? (
              <span
                className="block h-32 w-full rounded-2xl bg-cover bg-center"
                style={{ backgroundImage: `url("${categoryForm.image_url}")` }}
                aria-label="Anteprima immagine categoria"
                role="img"
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Icona"
                value={categoryForm.icon}
                onChange={(value) => setCategoryForm((current) => ({ ...current, icon: value }))}
                placeholder="engineering"
              />
              <Field
                label="Ordine"
                value={categoryForm.sort_order}
                onChange={(value) =>
                  setCategoryForm((current) => ({ ...current, sort_order: value }))
                }
                type="number"
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={categoryForm.is_active}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              Categoria attiva e visibile pubblicamente
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#FF8500] px-5 py-2 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Salva categoria"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-5 py-2 font-button text-primary"
              onClick={startCreateCategory}
            >
              Annulla
            </button>
          </div>
        </form>

        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
          <h2 className="font-headline-sm text-[24px] text-primary">Sottocategorie</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {expandedCategory
              ? `Categoria selezionata: ${expandedCategory.name}`
              : "Seleziona una categoria per gestire le sottocategorie."}
          </p>

          {expandedCategory ? (
            <>
              <div className="mt-5 space-y-3">
                {expandedCategory.subcategories.length === 0 ? (
                  <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    Nessuna sottocategoria configurata.
                  </div>
                ) : null}
                {expandedCategory.subcategories.map((subcategory) => (
                  <div
                    key={subcategory.id}
                    className="rounded-2xl border border-outline-variant/30 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-label-md text-primary">{subcategory.name}</h3>
                          <StatusPill active={subcategory.is_active} />
                        </div>
                        <p className="mt-1 break-all text-xs text-on-surface-variant">
                          {subcategory.slug} · ordine: {subcategory.sort_order}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary"
                        onClick={() => startEditSubcategory(expandedCategory, subcategory)}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface-variant"
                        onClick={() => void toggleSubcategory(subcategory)}
                      >
                        {subcategory.is_active ? "Disattiva" : "Riattiva"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form className="mt-5 space-y-4 border-t border-outline-variant/40 pt-5" onSubmit={saveSubcategory}>
                <h3 className="font-headline-sm text-[20px] text-primary">
                  {editingSubcategoryId ? "Modifica sottocategoria" : "Nuova sottocategoria"}
                </h3>
                <Field
                  label="Nome"
                  value={subcategoryForm.name}
                  onChange={(value) =>
                    setSubcategoryForm((current) => ({ ...current, name: value }))
                  }
                />
                <Field
                  label="Slug"
                  value={subcategoryForm.slug}
                  onChange={(value) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      slug: normalizeSlug(value),
                    }))
                  }
                  placeholder="es. progettazione"
                />
                <Field
                  label="Ordine"
                  value={subcategoryForm.sort_order}
                  onChange={(value) =>
                    setSubcategoryForm((current) => ({ ...current, sort_order: value }))
                  }
                  type="number"
                />
                <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={subcategoryForm.is_active}
                    onChange={(event) =>
                      setSubcategoryForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  Sottocategoria attiva
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-5 py-2 font-button text-white transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saving ? "Salvataggio…" : "Salva sottocategoria"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-5 py-2 font-button text-primary"
                    onClick={() => startCreateSubcategory(expandedCategory)}
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
