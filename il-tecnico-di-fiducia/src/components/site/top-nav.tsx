"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { id: "home", href: "/", label: "Home" },
  { id: "about", href: "/chi-siamo", label: "Chi siamo" },
  { id: "search", href: "/#professioni", label: "Cerca un tecnico" },
  {
    id: "become",
    href: "/auth/register?role=professional",
    label: "Diventa un tecnico",
  },
  {
    id: "suggest",
    href: "/proponi-un-tecnico",
    label: "Proponi un tecnico",
  },
  { id: "support", href: "/contattaci", label: "Segnala un problema" },
];

function desktopNavLinkClass(active: boolean) {
  return [
    "group relative inline-flex shrink-0 items-center",
    "rounded-full px-2 py-3",
    "text-[14px] font-semibold leading-none",
    "whitespace-nowrap",
    "transition-colors duration-200",
    "min-[1450px]:px-2.5 min-[1450px]:text-[15px]",
    "min-[1650px]:px-3 min-[1650px]:text-[16px]",
    active
      ? "text-primary"
      : "text-on-surface-variant hover:text-primary",
  ].join(" ");
}

function desktopNavUnderlineClass(active: boolean) {
  return [
    "pointer-events-none absolute inset-x-2 -bottom-0.5 h-[2px]",
    "origin-center rounded-full bg-[#FF8500]",
    "transition-all duration-200 ease-out",
    active
      ? "scale-x-100 opacity-100"
      : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-75",
  ].join(" ");
}

export function TopNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState("");
  const mobileMenuId = useId();

  useEffect(() => {
    function updateHash() {
      setCurrentHash(window.location.hash);
    }

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => {
      window.removeEventListener("hashchange", updateHash);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function isDesktopNavActive(href: string) {
    const [hrefPath, hrefHash] = href.split("#");
    const cleanPath = hrefPath.split("?")[0] || "/";

    if (hrefHash) {
      return pathname === cleanPath && currentHash === `#${hrefHash}`;
    }

    if (cleanPath === "/") {
      return pathname === "/" && currentHash !== "#professioni";
    }

    return pathname === cleanPath || pathname.startsWith(`${cleanPath}/`);
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-20 bg-surface-container-lowest/80 shadow-sm backdrop-blur-md sm:h-[100px]">
      <div className="mx-auto flex h-full w-full max-w-[1800px] items-center px-4 sm:px-6 lg:px-8 xl:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 rounded-full transition-transform hover:scale-[0.99]"
          aria-label="Torna alla homepage"
        >
          <Image
            src="/img/logo-mark.png"
            alt="Il Tecnico di Fiducia"
            width={128}
            height={128}
            className="h-11 w-11 shrink-0 object-contain sm:h-[60px] sm:w-[60px] min-[1500px]:h-[66px] min-[1500px]:w-[66px]"
            priority
          />

          <span className="hidden min-w-0 flex-col leading-none sm:flex">
            <span className="whitespace-nowrap text-[19px] font-bold text-primary min-[1500px]:text-[22px]">
              Il tecnico
            </span>

            <span className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.1em] text-on-tertiary-container min-[1500px]:text-[13px]">
              di fiducia
            </span>
          </span>
        </Link>

        <nav className="ml-6 hidden min-w-0 flex-1 items-center justify-center gap-1.5 xl:flex min-[1450px]:gap-2.5 min-[1650px]:gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={desktopNavLinkClass(
                isDesktopNavActive(link.href),
              )}
            >
              {link.label}

              <span
                className={desktopNavUnderlineClass(
                  isDesktopNavActive(link.href),
                )}
              />
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 xl:flex min-[1500px]:gap-3">
          <Link
            href="/auth/login"
            className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-3 text-[14px] font-semibold text-white shadow-md transition-colors hover:bg-primary-container active:scale-[0.99] min-[1500px]:px-5 min-[1500px]:py-3.5 min-[1500px]:text-[15px]"
          >
            Log In
          </Link>

          <Link
            href="/auth/register"
            className="shrink-0 whitespace-nowrap rounded-full bg-[#FF8500] px-4 py-3 text-[14px] font-semibold text-white shadow-md transition-colors hover:bg-[#FF9A2B] active:scale-[0.99] min-[1500px]:px-5 min-[1500px]:py-3.5 min-[1500px]:text-[15px]"
          >
            Inizia ora
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-outline-variant/40 text-primary transition-colors hover:bg-surface-container-high xl:hidden"
          aria-label="Apri menu"
          aria-controls={mobileMenuId}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="material-symbols-outlined" aria-hidden>
            menu
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[200] xl:hidden"
          id={mobileMenuId}
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-inverse-surface/45 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
          />

          <div
            className="absolute right-0 top-0 flex h-dvh w-[min(360px,88vw)] max-w-full flex-col overflow-y-auto border-l border-outline-variant/30 bg-surface-container-lowest p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principale"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[21px] font-semibold text-primary">
                Menu
              </span>

              <button
                type="button"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-high"
                onClick={() => setOpen(false)}
                aria-label="Chiudi menu"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {navLinks.map((link) => (
                <Link
                  key={`mobile-${link.id}`}
                  href={link.href}
                  className="min-h-11 rounded-xl px-3 py-3 text-[15px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-2 flex flex-col gap-2 border-t border-outline-variant/30 pt-3">
                <Link
                  href="/auth/login"
                  className="min-h-11 rounded-xl bg-primary px-3 py-3 text-center font-semibold text-white transition-colors hover:bg-primary-container"
                  onClick={() => setOpen(false)}
                >
                  Log In
                </Link>

                <Link
                  href="/auth/register"
                  className="min-h-11 rounded-xl bg-[#FF8500] px-3 py-3 text-center font-semibold text-white transition-colors hover:bg-[#FF9A2B]"
                  onClick={() => setOpen(false)}
                >
                  Inizia ora
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}