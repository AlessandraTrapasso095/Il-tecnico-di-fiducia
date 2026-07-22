"use client";

import { useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type StartCheckoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function StartCheckoutButton({ className, children }: StartCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ url: string }>("/api/billing/checkout", { method: "POST" });
      if (!res.url) {
        throw new Error("Checkout URL missing");
      }
      window.location.assign(res.url);
    } catch (checkoutError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[billing] Failed to start Stripe checkout", checkoutError);
      }
      setError("Non è stato possibile avviare il pagamento. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Apertura del pagamento in corso…" : children ?? "Attiva abbonamento"}
      </button>
      {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
    </div>
  );
}
