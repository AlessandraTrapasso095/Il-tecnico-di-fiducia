"use client";

import { useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type StartCheckoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function StartCheckoutButton({ className, children }: StartCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ url: string }>("/api/billing/checkout", { method: "POST" });
      window.location.assign(res.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={loading}>
      {children ?? (loading ? "Apertura checkout…" : "Attiva abbonamento")}
    </button>
  );
}

