"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { id: "home", href: "/", label: "Home" },
  { id: "about", href: "/chi-siamo", label: "Chi siamo" },
  { id: "search", href: "/#professioni", label: "Cerca un tecnico" },
  { id: "become", href: "/auth/register?role=professional", label: "Diventa un tecnico" },
  { id: "suggest", href: "/proponi-un-tecnico", label: "Proponi un tecnico" },
  { id: "support", href: "/contattaci", label: "Segnala un problema" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);
  const mobileMenuId = useId();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-20 bg-surface-container-lowest/80 shadow-sm backdrop-blur-md sm:h-[100px]">
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2 sm:gap-2.5 rounded-full pr-2 transition-transform hover:scale-[0.99]"
          aria-label="Torna alla landing"
        >
          <Image
            src="/img/logo-mark.png"
            alt="Il Tecnico di Fiducia"
            width={128}
            height={128}
            className="h-11 w-11 shrink-0 object-contain sm:h-[68px] sm:w-[68px]"
            priority
          />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="font-headline-sm text-[16px] font-bold text-primary sm:text-[23px]">
              Il tecnico
            </span>
            <span className="font-label-md text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-tertiary-container sm:text-[14px]">
              di fiducia
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-4 xl:flex xl:gap-6">
          {navLinks.map((l) => (
            <Link
              key={l.id}
              href={l.href}
              className="font-label-md text-[13px] text-on-surface-variant transition-colors hover:text-on-tertiary-container xl:text-label-md"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link
            href="/auth/login"
            className="font-button text-button bg-primary text-white px-6 py-3 rounded-full shadow-md hover:bg-primary-container transition-colors active:scale-[0.99]"
          >
            Log In
          </Link>
          <Link
            href="/auth/register"
            className="font-button text-button bg-[#FF8500] text-white px-6 py-3 rounded-full shadow-md hover:bg-[#FF9A2B] transition-colors active:scale-[0.99]"
          >
            Inizia ora
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-outline-variant/40 text-primary transition-colors hover:bg-surface-container-high xl:hidden"
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
        <div className="fixed inset-0 z-[200] xl:hidden" id={mobileMenuId}>
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
              <span className="font-headline-sm text-[21px] text-primary">Menu</span>
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
              {navLinks.map((l) => (
                <Link
                  key={`mobile-${l.id}`}
                  href={l.href}
                  className="min-h-11 rounded-xl px-3 py-3 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}

              <div className="mt-2 flex flex-col gap-2 border-t border-outline-variant/30 pt-2">
                <Link
                  href="/auth/login"
                  className="min-h-11 rounded-xl bg-primary px-3 py-3 text-center font-button text-button text-white transition-colors hover:bg-primary-container"
                  onClick={() => setOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="min-h-11 rounded-xl bg-[#FF8500] px-3 py-3 text-center font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
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
