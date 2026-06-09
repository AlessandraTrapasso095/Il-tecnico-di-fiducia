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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[100px] bg-surface-container-lowest/80 backdrop-blur-md shadow-sm">
      <div className="h-full w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0" aria-label="Torna alla landing">
          <Image
            src="/img/logo.png"
            alt="Il Tecnico di Fiducia"
            width={96}
            height={64}
            className="h-14 sm:h-16 w-auto shrink-0 object-contain"
            priority
          />
          <span className="flex flex-col leading-none min-w-0">
            <span className="font-headline-sm text-[18px] sm:text-[21px] font-bold text-primary truncate">
              Il tecnico
            </span>
            <span className="font-label-md text-[12px] sm:text-[14px] font-bold uppercase tracking-[0.14em] text-on-tertiary-container truncate">
              di fiducia
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
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

        <div className="hidden md:flex items-center gap-3">
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
          className="md:hidden w-11 h-11 rounded-full border border-outline-variant/40 text-primary hover:bg-surface-container-high transition-colors"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open ? (
        <div className="md:hidden fixed inset-0 top-[100px] z-50">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/30 shadow-lg">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-2">
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
