"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/api/fetch-json";

type SignOutButtonProps = {
  className?: string;
  children?: React.ReactNode;
  loadingPresentation?: "inline" | "compact";
  "aria-label"?: string;
};

export function SignOutButton({
  className,
  children,
  loadingPresentation = "inline",
  "aria-label": ariaLabel,
}: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;

    setLoading(true);

    try {
      await fetchJson<{ ok: true }>("/api/auth/sign-out", {
        method: "POST",
      });

      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={[
        className,
        loadingPresentation === "compact" ? "relative overflow-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading ? (
        loadingPresentation === "compact" ? (
          <span className="material-symbols-outlined animate-spin" aria-hidden>
            progress_activity
          </span>
        ) : (
          <>
            <span
              className="material-symbols-outlined animate-spin text-[19px]"
              aria-hidden
            >
              progress_activity
            </span>
            Caricamento…
          </>
        )
      ) : (
        (children ?? "Esci")
      )}
    </button>
  );
}
