"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { fetchJson } from "@/lib/api/fetch-json";

type FollowedProfessional = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  province_code: string | null;
};

type FollowsResponse = {
  followed: FollowedProfessional[];
};

function fullName(person: Pick<FollowedProfessional, "first_name" | "last_name">) {
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Professionista";
}

export default function FollowedProfessionalsClient() {
  const [professionals, setProfessionals] = useState<FollowedProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchJson<FollowsResponse>("/api/follows", { method: "GET" })
      .then((response) => {
        if (!mounted) return;
        setProfessionals(response.followed ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Impossibile caricare i seguiti.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
          Network
        </span>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary">Seguiti</h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Tutti i professionisti che segui. I loro post continuano a comparire nel feed della
              dashboard.
            </p>
          </div>
          {loading ? (
            <span className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-bold text-primary">
              Caricamento…
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-error/20 bg-error-container p-5 text-on-error-container">
          {error}
        </div>
      ) : null}

      {!loading && !error && professionals.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <h2 className="mt-4 font-headline-sm text-[22px] text-primary">
            Non segui ancora nessun professionista
          </h2>
          <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">
            Usa la ricerca nell’header per trovare professionisti registrati e seguire i profili
            che vuoi tenere nel tuo feed.
          </p>
        </div>
      ) : null}

      {professionals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {professionals.map((professional) => (
            <Link
              key={professional.id}
              href={`/professionisti/${professional.id}`}
              className="group rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(8,43,95,0.12)]"
            >
              <div className="flex gap-4">
                <ProfileAvatar
                  person={professional}
                  alt={fullName(professional)}
                  size="xl"
                  fallback="P"
                  className="border-2 border-primary-container"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-headline-sm text-[22px] text-primary">
                    {fullName(professional)}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-on-surface-variant">
                    {professional.headline ?? "Professionista"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary-fixed px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-on-primary-fixed-variant">
                      {professional.province_code ?? "Provincia non indicata"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#FF8500] px-5 py-2.5 font-button text-sm text-white shadow-md transition group-hover:bg-[#FF9A2B]">
                  Vedi profilo
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
