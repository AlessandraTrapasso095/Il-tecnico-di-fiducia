"use client";

import { useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type StartPortalButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function StartPortalButton({ className, children }: StartPortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ url: string }>("/api/billing/portal", {
        method: "POST",
      });
      window.location.assign(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire Stripe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {loading ? "Apertura gestione…" : (children ?? "Gestisci abbonamento")}
      </button>
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </span>
  );
}
