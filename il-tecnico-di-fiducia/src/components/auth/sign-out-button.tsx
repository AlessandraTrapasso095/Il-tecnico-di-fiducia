"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";

type SignOutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      await fetchJson<{ ok: true }>("/api/auth/sign-out", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={loading}>
      {children ?? (loading ? "Uscita…" : "Esci")}
    </button>
  );
}

