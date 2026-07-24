"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

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
  professional_count: number;
  subcategories: ManagedSubcategory[];
};

type CategoriesResponse = {
  categories: ManagedCategory[];
};

type CategoryImageUploadResponse = {
  image_url: string;
  path: string;
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function orderedSubcategories(subcategories: ManagedSubcategory[]) {
  return [...subcategories].sort(
    (first, second) =>
      first.sort_order - second.sort_order || first.name.localeCompare(second.name, "it"),
  );
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("it-IT").format(value ?? 0);
}

async function removeCategoryImage(imageUrl: string | null) {
  if (!imageUrl) return;
  await fetchJson<{ ok: boolean }>("/api/admin/category-images", {
    method: "DELETE",
    body: JSON.stringify({ image_url: imageUrl }),
  });
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryOriginalImageUrl, setEditingCategoryOriginalImageUrl] =
    useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function startCreateCategory() {
    setEditingCategoryId(null);
    setEditingCategoryOriginalImageUrl(null);
    setCategoryForm(emptyCategoryForm());
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setMessage(null);
    setError(null);
  }

  function startEditCategory(category: ManagedCategory) {
    setEditingCategoryId(fullId(category.id));
    setEditingCategoryOriginalImageUrl(category.image_url ?? null);
    setCategoryForm(categoryFormFrom(category));
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setExpandedCategoryId(fullId(category.id));
    setMessage(null);
    setError(null);
  }

  async function uploadCategoryImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Seleziona un file immagine valido.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L’immagine non può superare 5 MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageUploading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/category-images", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | CategoryImageUploadResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("image_url" in payload)) {
        const errorMessage =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Non è stato possibile caricare l’immagine.";
        throw new Error(errorMessage);
      }

      setCategoryForm((current) => ({ ...current, image_url: payload.image_url }));
      setMessage("Immagine caricata. Salva la categoria per applicarla al catalogo.");
    } catch (uploadError) {
      setImagePreviewUrl(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Non è stato possibile caricare l’immagine.",
      );
    } finally {
      setImageUploading(false);
    }
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
        if (
          editingCategoryOriginalImageUrl &&
          editingCategoryOriginalImageUrl !== payload.image_url
        ) {
          await removeCategoryImage(editingCategoryOriginalImageUrl).catch(() => undefined);
        }
        setEditingCategoryOriginalImageUrl(payload.image_url);
        setMessage("Categoria aggiornata.");
      } else {
        const response = await fetchJson<{ category: ManagedCategory }>("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Categoria creata.");
        setExpandedCategoryId(fullId(response.category.id));
        setCategoryForm(emptyCategoryForm());
        setEditingCategoryOriginalImageUrl(null);
        setImagePreviewUrl(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
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

  async function deleteCategory(category: ManagedCategory) {
    if (
      !window.confirm(
        `Eliminare definitivamente “${category.name}”? Usa questa azione solo se la categoria non ha profili o sottocategorie associate.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/categories/${encodeURIComponent(fullId(category.id))}`, {
        method: "DELETE",
      });
      await removeCategoryImage(category.image_url).catch(() => undefined);
      setMessage("Categoria eliminata.");
      if (expandedCategoryId === fullId(category.id)) setExpandedCategoryId(null);
      await loadCategories();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Non è stato possibile eliminare la categoria.",
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

  async function deleteSubcategory(subcategory: ManagedSubcategory) {
    if (!window.confirm(`Eliminare definitivamente “${subcategory.name}”?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/admin/subcategories/${encodeURIComponent(subcategory.id)}`, {
        method: "DELETE",
      });
      setMessage("Sottocategoria eliminata.");
      if (editingSubcategoryId === subcategory.id) {
        setEditingSubcategoryId(null);
        setSubcategoryForm(emptySubcategoryForm());
      }
      await loadCategories();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Non è stato possibile eliminare la sottocategoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveCategory(category: ManagedCategory, direction: -1 | 1) {
    const currentIndex = sortedCategories.findIndex(
      (currentCategory) => fullId(currentCategory.id) === fullId(category.id),
    );
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedCategories.length) return;

    const nextCategories = [...sortedCategories];
    [nextCategories[currentIndex], nextCategories[targetIndex]] = [
      nextCategories[targetIndex],
      nextCategories[currentIndex],
    ];

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/admin/categories/reorder", {
        method: "PATCH",
        body: JSON.stringify({
          items: nextCategories.map((item, index) => ({
            id: fullId(item.id),
            sort_order: (index + 1) * 1000,
          })),
        }),
      });
      setMessage("Ordine categorie aggiornato.");
      await loadCategories();
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : "Non è stato possibile riordinare le categorie.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveSubcategory(subcategory: ManagedSubcategory, direction: -1 | 1) {
    if (!expandedCategory) return;
    const sortedSubcategories = orderedSubcategories(expandedCategory.subcategories);
    const currentIndex = sortedSubcategories.findIndex((item) => item.id === subcategory.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedSubcategories.length) return;

    const nextSubcategories = [...sortedSubcategories];
    [nextSubcategories[currentIndex], nextSubcategories[targetIndex]] = [
      nextSubcategories[targetIndex],
      nextSubcategories[currentIndex],
    ];

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson(
        `/api/admin/categories/${encodeURIComponent(fullId(expandedCategory.id))}/subcategories/reorder`,
        {
          method: "PATCH",
          body: JSON.stringify({
            items: nextSubcategories.map((item, index) => ({
              id: item.id,
              sort_order: (index + 1) * 1000,
            })),
          }),
        },
      );
      setMessage("Ordine sottocategorie aggiornato.");
      await loadCategories();
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : "Non è stato possibile riordinare le sottocategorie.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="font-label-md text-xs uppercase tracking-[0.16em] text-[#FF8500]">
              Catalogo dinamico
            </p>
            <h2 className="mt-1 font-headline-sm text-[28px] leading-tight text-primary">
              Categorie e professioni
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Gestisci il catalogo usato dal sito pubblico. Le categorie inattive restano
              disponibili nell’admin, ma non vengono mostrate a clienti e visitatori.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 font-button text-white transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20"
            onClick={startCreateCategory}
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Aggiungi categoria
          </button>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-2xl bg-error-container p-4 text-sm font-medium text-on-error-container">
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

        <div className="mt-6 space-y-4">
          {sortedCategories.map((category, index) => {
            const expanded = fullId(category.id) === expandedCategoryId;
            const subcategories = orderedSubcategories(category.subcategories);
            const previewSubcategories = subcategories.slice(0, 5);
            const canDelete =
              category.subcategories.length === 0 && (category.professional_count ?? 0) === 0;

            return (
              <article
                key={fullId(category.id)}
                className={[
                  "rounded-[26px] border p-4 transition sm:p-5",
                  expanded
                    ? "border-primary/45 bg-primary-fixed/25 shadow-[0_12px_30px_rgba(8,43,95,0.10)]"
                    : "border-outline-variant/30 bg-white shadow-sm",
                ].join(" ")}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <button
                    type="button"
                    className="grid min-w-0 gap-4 rounded-3xl text-left focus:outline-none focus:ring-4 focus:ring-primary/20 sm:grid-cols-[88px_minmax(0,1fr)]"
                    onClick={() => setExpandedCategoryId(fullId(category.id))}
                    aria-expanded={expanded}
                  >
                    {category.image_url && isPreviewableImage(category.image_url) ? (
                      <span
                        className="h-28 w-full shrink-0 rounded-[22px] bg-cover bg-center sm:h-24 sm:w-24"
                        style={{ backgroundImage: `url("${category.image_url}")` }}
                        aria-hidden
                      />
                    ) : (
                      <span className="flex h-28 w-full shrink-0 items-center justify-center rounded-[22px] bg-primary-fixed text-primary sm:h-24 sm:w-24">
                        <span className="material-symbols-outlined text-[34px]">
                          {category.icon || "category"}
                        </span>
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-[23px] leading-tight text-primary">
                          {category.name}
                        </span>
                        <StatusPill active={category.is_active} />
                      </span>
                      <span className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
                        slug: {category.slug}
                      </span>
                      <span className="mt-3 grid gap-2 text-sm text-on-surface-variant sm:grid-cols-2 xl:grid-cols-4">
                        <span>{compactNumber(category.subcategories.length)} sottocategorie</span>
                        <span>{compactNumber(category.professional_count)} professionisti</span>
                        <span>Ordine {category.sort_order}</span>
                        <span>Agg. {formatDateTime(category.updated_at)}</span>
                      </span>
                      {category.description ? (
                        <span className="mt-3 block text-sm leading-6 text-on-surface">
                          {category.description}
                        </span>
                      ) : null}
                      <span className="mt-4 flex flex-wrap gap-2">
                        {previewSubcategories.length > 0 ? (
                          previewSubcategories.map((subcategory) => (
                            <span
                              key={subcategory.id}
                              className="inline-flex max-w-full rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant"
                            >
                              <span className="truncate">{subcategory.name}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-on-surface-variant">
                            Nessuna sottocategoria configurata.
                          </span>
                        )}
                        {subcategories.length > previewSubcategories.length ? (
                          <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary">
                            +{subcategories.length - previewSubcategories.length}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2 lg:w-[230px] lg:grid-cols-1">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary transition hover:bg-surface-container-high focus:outline-none focus:ring-4 focus:ring-primary/20"
                      onClick={() => startEditCategory(category)}
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-primary transition hover:bg-surface-container-high focus:outline-none focus:ring-4 focus:ring-primary/20"
                      onClick={() => startCreateSubcategory(category)}
                    >
                      Gestisci sottocategorie
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant px-3 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={saving || index === 0}
                        onClick={() => void moveCategory(category, -1)}
                      >
                        Su
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant px-3 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={saving || index === sortedCategories.length - 1}
                        onClick={() => void moveCategory(category, 1)}
                      >
                        Giù
                      </button>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving}
                      onClick={() => void toggleCategory(category)}
                    >
                      {category.is_active ? "Disattiva" : "Riattiva"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-error/30 px-4 py-2 text-sm font-bold text-error transition hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || !canDelete}
                      title={
                        canDelete
                          ? "Elimina definitivamente la categoria"
                          : "Elimina disponibile solo senza professionisti e sottocategorie."
                      }
                      onClick={() => void deleteCategory(category)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="space-y-5 2xl:sticky 2xl:top-28 2xl:self-start">
        <form
          className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6"
          onSubmit={saveCategory}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label-md text-xs uppercase tracking-[0.14em] text-[#FF8500]">
                Categoria
              </p>
              <h2 className="mt-1 font-headline-sm text-[24px] leading-tight text-primary">
                {editingCategoryId ? "Modifica categoria" : "Nuova categoria"}
              </h2>
            </div>
            {editingCategoryId ? <StatusPill active={categoryForm.is_active} /> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            Lo slug delle categorie già usate viene bloccato quando potrebbe rompere URL,
            filtri o profili collegati.
          </p>
          <div className="mt-5 space-y-4">
            <Field
              label="Nome"
              value={categoryForm.name}
              onChange={(value) =>
                setCategoryForm((current) => ({
                  ...current,
                  name: value,
                  slug: current.slug ? current.slug : normalizeSlug(value),
                }))
              }
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
                className="min-h-28 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
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
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => void uploadCategoryImage(event)}
              />
              <div className="space-y-3">
                <p className="text-sm leading-6 text-on-surface-variant">
                  Carica JPG, PNG o WebP fino a 5 MB. L’immagine viene salvata su Supabase
                  Storage e applicata al salvataggio.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  <button
                    type="button"
                    disabled={imageUploading || saving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-surface-container-high disabled:opacity-60"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    {imageUploading ? "Upload…" : "Carica immagine"}
                  </button>
                  {categoryForm.image_url ? (
                    <button
                      type="button"
                      disabled={imageUploading || saving}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-60"
                      onClick={() => {
                        setCategoryForm((current) => ({ ...current, image_url: "" }));
                        setImagePreviewUrl(null);
                      }}
                    >
                      Rimuovi URL
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {(imagePreviewUrl || categoryForm.image_url) &&
            isPreviewableImage(imagePreviewUrl || categoryForm.image_url) ? (
              <span
                className="block h-40 w-full rounded-2xl bg-cover bg-center"
                style={{ backgroundImage: `url("${imagePreviewUrl || categoryForm.image_url}")` }}
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
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-sm font-medium text-primary">
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
          <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF8500] px-5 py-2 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Salva categoria"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-5 py-2 font-button text-primary transition hover:bg-surface-container-high"
              onClick={startCreateCategory}
            >
              Annulla
            </button>
          </div>
        </form>

        <section className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-label-md text-xs uppercase tracking-[0.14em] text-[#FF8500]">
                Sottocategorie
              </p>
              <h2 className="mt-1 font-headline-sm text-[24px] leading-tight text-primary">
                {expandedCategory ? expandedCategory.name : "Seleziona una categoria"}
              </h2>
            </div>
            {expandedCategory ? (
              <span className="shrink-0 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary">
                {expandedCategory.subcategories.length}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {expandedCategory
              ? "Aggiungi, modifica, riordina o disattiva le specializzazioni della categoria."
              : "Apri una categoria dall’elenco per gestire le relative sottocategorie."}
          </p>

          {expandedCategory ? (
            <>
              <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {expandedCategory.subcategories.length === 0 ? (
                  <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    Nessuna sottocategoria configurata.
                  </div>
                ) : null}
                {orderedSubcategories(expandedCategory.subcategories).map((subcategory, index) => (
                  <div
                    key={subcategory.id}
                    className="rounded-2xl border border-outline-variant/30 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-label-md leading-snug text-primary">
                            {subcategory.name}
                          </h3>
                          <StatusPill active={subcategory.is_active} />
                        </div>
                        <p className="mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                          {subcategory.slug} · ordine {subcategory.sort_order}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-primary transition hover:bg-surface-container-high"
                        onClick={() => startEditSubcategory(expandedCategory, subcategory)}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high"
                        onClick={() => void toggleSubcategory(subcategory)}
                      >
                        {subcategory.is_active ? "Disattiva" : "Riattiva"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-40"
                        disabled={saving || index === 0}
                        onClick={() => void moveSubcategory(subcategory, -1)}
                      >
                        Su
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-40"
                        disabled={saving || index === expandedCategory.subcategories.length - 1}
                        onClick={() => void moveSubcategory(subcategory, 1)}
                      >
                        Giù
                      </button>
                      <button
                        type="button"
                        className="col-span-2 rounded-full border border-error/30 px-3 py-2 text-xs font-bold text-error transition hover:bg-error-container disabled:opacity-50"
                        disabled={saving}
                        onClick={() => void deleteSubcategory(subcategory)}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form
                className="mt-5 space-y-4 border-t border-outline-variant/40 pt-5"
                onSubmit={saveSubcategory}
              >
                <h3 className="font-headline-sm text-[20px] text-primary">
                  {editingSubcategoryId ? "Modifica sottocategoria" : "Nuova sottocategoria"}
                </h3>
                <Field
                  label="Nome"
                  value={subcategoryForm.name}
                  onChange={(value) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      name: value,
                      slug: current.slug ? current.slug : normalizeSlug(value),
                    }))
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
                <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-sm font-medium text-primary">
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
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 font-button text-white transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saving ? "Salvataggio…" : "Salva sottocategoria"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-5 py-2 font-button text-primary transition hover:bg-surface-container-high"
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
