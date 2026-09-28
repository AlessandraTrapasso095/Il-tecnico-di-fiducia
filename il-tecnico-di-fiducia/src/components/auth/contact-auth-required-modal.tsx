"use client";

import Link from "next/link";
import { useEffect } from "react";

type ContactAuthRequiredModalProps = {
  open: boolean;
  onClose: () => void;
  loginHref: string;
  registerHref: string;
};

export function ContactAuthRequiredModal({
  open,
  onClose,
  loginHref,
  registerHref,
}: ContactAuthRequiredModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/35 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-auth-title"
        aria-describedby="contact-auth-description"
        className="relative w-full max-w-[470px] rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_24px_80px_rgba(8,43,95,0.26)] sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
        >
          <span className="material-symbols-outlined" aria-hidden>
            close
          </span>
        </button>

        <div className="flex size-14 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <span className="material-symbols-outlined text-[28px]" aria-hidden>
            person
          </span>
        </div>

        <h2
          id="contact-auth-title"
          className="mt-5 pr-8 font-headline-sm text-[25px] leading-tight text-primary"
        >
          Vuoi contattare questo professionista?
        </h2>

        <p
          id="contact-auth-description"
          className="mt-3 text-sm leading-6 text-on-surface-variant sm:text-base"
        >
          Per contattare il professionista devi essere registrato/a oppure
          accedere al tuo account.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href={loginHref}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-button text-white transition hover:bg-secondary"
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden>
              login
            </span>
            Accedi
          </Link>

          <Link
            href={registerHref}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-5 py-3 font-button text-white shadow-md shadow-orange-500/15 transition hover:bg-[#FF9A2B]"
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden>
              person_add
            </span>
            Registrati
          </Link>
        </div>
      </div>
    </div>
  );
}
