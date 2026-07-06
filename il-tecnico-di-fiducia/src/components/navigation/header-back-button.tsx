"use client";

import { usePathname, useRouter } from "next/navigation";

type HeaderBackButtonProps = {
  fallbackHref: string;
  hiddenPathnames?: string[];
  forceVisible?: boolean;
  onBack?: () => void;
  className?: string;
};

function normalizePathname(pathname: string | null) {
  if (!pathname) return "/";
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function HeaderBackButton({
  fallbackHref,
  hiddenPathnames = [],
  forceVisible,
  onBack,
  className = "",
}: HeaderBackButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPathname = normalizePathname(pathname);
  const hidden = hiddenPathnames.map(normalizePathname).includes(normalizedPathname);
  const visible = forceVisible ?? !hidden;

  if (!visible) return null;

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      className={[
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/25",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Torna indietro"
      onClick={goBack}
    >
      <span className="material-symbols-outlined text-[24px]" aria-hidden>
        arrow_back
      </span>
    </button>
  );
}
