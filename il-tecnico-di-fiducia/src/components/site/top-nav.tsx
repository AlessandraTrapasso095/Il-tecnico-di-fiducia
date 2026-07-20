"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { id: "explore", href: "#professioni", label: "Esplora" },
  { id: "how-it-works", href: "#come-funziona", label: "Come funziona" },
  { id: "professions", href: "#professioni", label: "Professioni" },
  { id: "support", href: "#supporto", label: "Supporto" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);

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

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <a
              key={l.id}
              href={l.href}
              className="font-label-md text-label-md text-on-surface-variant hover:text-on-tertiary-container transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/auth/login"
            className="font-button text-button text-primary px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors"
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
          className="h-11 w-11 rounded-full border border-outline-variant/40 text-primary transition-colors hover:bg-surface-container-high lg:hidden"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-20 z-50 sm:top-[100px] lg:hidden">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-0 max-h-full overflow-y-auto border-t border-outline-variant/30 bg-surface-container-lowest shadow-lg">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {navLinks.map((l) => (
                <a
                  key={`mobile-${l.id}`}
                  href={l.href}
                  className="px-3 py-3 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}

              <div className="pt-2 mt-2 border-t border-outline-variant/30 flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  className="px-3 py-3 rounded-xl font-button text-button text-primary hover:bg-surface-container-low transition-colors text-center"
                  onClick={() => setOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="px-3 py-3 rounded-xl font-button text-button bg-[#FF8500] text-white hover:bg-[#FF9A2B] transition-colors text-center"
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
