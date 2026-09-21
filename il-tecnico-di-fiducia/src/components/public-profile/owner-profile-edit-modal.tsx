"use client";

import { useState, type ReactNode } from "react";

import type { PublicProfessionalProfileDetails } from "@/lib/server/professional-profile";

export type OwnerProfileContacts = {
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
};

type OwnerProfileEditDraft = {
  first_name: string;
  last_name: string;
  bio: string;
  province_code: string;
  phone: string;
  public_email: string;
  website_url: string;
  services_offered: string;
  operational_provinces: string;
  education: string;
  work_experiences: string;
  certifications: string;
  available_remote: boolean;
  available_travel: boolean;
  is_ctu: boolean;
  is_ctp: boolean;
};

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeWebsite(value: string): string | null {
  const clean = value.trim();

  if (!clean) {
    return null;
  }

  if (clean.startsWith("https://") || clean.startsWith("http://")) {
    return clean;
  }

  return `https://${clean}`;
}

export function OwnerProfileEditModal({
  profile,
  contacts,
  onClose,
}: {
  profile: PublicProfessionalProfileDetails;
  contacts: OwnerProfileContacts | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<OwnerProfileEditDraft>(() => ({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    bio: profile.bio ?? "",
    province_code: profile.province_code ?? "",
    phone: contacts?.phone ?? "",
    public_email: contacts?.email ?? "",
    website_url: contacts?.websiteUrl ?? "",
    services_offered: profile.services_offered.join("\n"),
    operational_provinces: profile.operational_provinces.join("\n"),
    education: profile.education.join("\n"),
    work_experiences: profile.work_experiences.join("\n"),
    certifications: profile.certifications.join("\n"),
    available_remote: profile.available_remote,
    available_travel: profile.available_travel,
    is_ctu: profile.is_ctu,
    is_ctp: profile.is_ctp,
  }));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue<K extends keyof OwnerProfileEditDraft>(
    key: K,
    value: OwnerProfileEditDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save() {
    if (saving || !draft.first_name.trim() || !draft.last_name.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/professionals/${profile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          bio: draft.bio.trim() || null,
          province_code: draft.province_code.trim().toUpperCase() || null,
          phone: draft.phone.trim() || null,
          public_email: draft.public_email.trim() || null,
          website_url: normalizeWebsite(draft.website_url),
          services_offered: lines(draft.services_offered),
          operational_provinces: lines(draft.operational_provinces).map(
            (value) => value.toUpperCase(),
          ),
          education: lines(draft.education),
          work_experiences: lines(draft.work_experiences),
          certifications: lines(draft.certifications),
          available_remote: draft.available_remote,
          available_travel: draft.available_travel,
          is_ctu: draft.is_ctu,
          is_ctp: draft.is_ctp,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error ?? "Non è stato possibile salvare il profilo.",
        );
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Non è stato possibile salvare il profilo.",
      );

      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-edit-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
    >
      <button
        type="button"
        aria-label="Chiudi modifica profilo"
        className="absolute inset-0 bg-inverse-surface/45 backdrop-blur-sm"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
      />

      <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[900px] flex-col overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-[30px]">
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-5 py-5 sm:px-7">
          <div>
            <h2
              id="owner-edit-title"
              className="font-headline-sm text-[26px] text-primary sm:text-[30px]"
            >
              Modifica profilo
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Aggiorna le informazioni del tuo profilo professionale.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            aria-label="Chiudi"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary-fixed disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          <div className="space-y-9">
            <EditSection title="Profilo">
              <div className="grid gap-4 sm:grid-cols-2">
                <EditInput
                  label="Nome"
                  value={draft.first_name}
                  onChange={(value) => setValue("first_name", value)}
                />

                <EditInput
                  label="Cognome"
                  value={draft.last_name}
                  onChange={(value) => setValue("last_name", value)}
                />
              </div>

              <EditInput
                label="Provincia"
                value={draft.province_code}
                placeholder="CZ"
                onChange={(value) =>
                  setValue("province_code", value.toUpperCase().slice(0, 2))
                }
              />

              <EditTextarea
                label="Bio"
                value={draft.bio}
                rows={7}
                onChange={(value) => setValue("bio", value)}
              />
            </EditSection>

            <EditSection title="Disponibilità e qualifiche">
              <div className="grid gap-3 sm:grid-cols-2">
                <EditToggle
                  label="Disponibile da remoto"
                  checked={draft.available_remote}
                  onChange={(value) => setValue("available_remote", value)}
                />

                <EditToggle
                  label="Disponibile per trasferte"
                  checked={draft.available_travel}
                  onChange={(value) => setValue("available_travel", value)}
                />

                <EditToggle
                  label="CTU"
                  checked={draft.is_ctu}
                  onChange={(value) => setValue("is_ctu", value)}
                />

                <EditToggle
                  label="CTP"
                  checked={draft.is_ctp}
                  onChange={(value) => setValue("is_ctp", value)}
                />
              </div>
            </EditSection>

            <EditSection title="Dati di contatto">
              <div className="grid gap-4 sm:grid-cols-2">
                <EditInput
                  label="Telefono"
                  value={draft.phone}
                  onChange={(value) => setValue("phone", value)}
                />

                <EditInput
                  label="Email pubblica"
                  type="email"
                  value={draft.public_email}
                  onChange={(value) => setValue("public_email", value)}
                />
              </div>

              <EditInput
                label="Sito web"
                value={draft.website_url}
                placeholder="https://..."
                onChange={(value) => setValue("website_url", value)}
              />
            </EditSection>

            <EditSection title="Attività professionale">
              <EditTextarea
                label="Servizi offerti"
                hint="Una voce per riga"
                value={draft.services_offered}
                onChange={(value) => setValue("services_offered", value)}
              />

              <EditTextarea
                label="Province operative"
                hint="Una sigla per riga"
                value={draft.operational_provinces}
                onChange={(value) => setValue("operational_provinces", value)}
              />
            </EditSection>

            <EditSection title="Curriculum">
              <EditTextarea
                label="Studi e formazione"
                hint="Una voce per riga"
                value={draft.education}
                onChange={(value) => setValue("education", value)}
              />

              <EditTextarea
                label="Esperienze lavorative"
                hint="Una voce per riga"
                value={draft.work_experiences}
                onChange={(value) => setValue("work_experiences", value)}
              />

              <EditTextarea
                label="Certificazioni"
                hint="Una voce per riga"
                value={draft.certifications}
                onChange={(value) => setValue("certifications", value)}
              />
            </EditSection>

            {error ? (
              <div
                role="alert"
                className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container"
              >
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-11 rounded-full px-6 py-2.5 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-50"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={
              saving || !draft.first_name.trim() || !draft.last_name.trim()
            }
            onClick={() => void save()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-7 py-2.5 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[19px]">
                  progress_activity
                </span>
                Salvataggio…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[19px]">
                  save
                </span>
                Salva modifiche
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function EditSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="font-headline-sm text-[21px] text-primary">{title}</h3>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-primary">{label}</span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-primary">{label}</span>

      {hint ? (
        <span className="ml-2 text-xs text-on-surface-variant">{hint}</span>
      ) : null}

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function EditToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface-container-low px-4 py-3">
      <span className="text-sm font-bold text-primary">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-[#FF8500]"
      />
    </label>
  );
}
