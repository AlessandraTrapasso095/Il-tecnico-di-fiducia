import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeaderBackButton } from "@/components/navigation/header-back-button";
import { Footer } from "@/components/site/footer";

type CustomerAreaShellProps = {
  children: ReactNode;
};

export function CustomerAreaShell({ children }: CustomerAreaShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed top-0 z-50 h-[92px] w-full bg-surface-container-lowest/88 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderBackButton
              fallbackHref="/customer"
              hiddenPathnames={["/customer", "/cliente"]}
            />
            <Link href="/customer" className="flex min-w-0 items-center gap-2.5">
              <Image
                src="/img/logo-mark.png"
                alt="Il Tecnico di Fiducia"
                width={54}
                height={54}
                className="h-[46px] w-[46px] shrink-0 object-contain sm:h-[54px] sm:w-[54px]"
                priority
              />
              <span className="leading-none">
                <span className="block font-headline-sm text-[18px] font-bold text-[#FF8500] sm:text-[21px]">
                  Il tecnico
                </span>
                <span className="block font-headline-sm text-[18px] font-bold text-primary sm:text-[21px]">
                  di fiducia
                </span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/customer"
              className="font-label-md text-label-md font-bold text-on-tertiary-container underline decoration-2 underline-offset-8"
            >
              Cerca
            </Link>
            <Link
              href="/customer#richieste"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-tertiary-container"
            >
              Richieste
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/customer"
              className="rounded-full p-2 text-primary transition-all hover:bg-surface-container-high"
              title="Preferiti"
              aria-label="Apri preferiti"
            >
              <span className="material-symbols-outlined" aria-hidden>
                favorite
              </span>
            </Link>
            <Link
              href="/customer?section=messages"
              className="rounded-full p-2 text-primary transition-all hover:bg-surface-container-high"
              title="Messaggi"
              aria-label="Apri messaggi"
            >
              <span className="material-symbols-outlined" aria-hidden>
                chat
              </span>
            </Link>
            <SignOutButton
              className="rounded-full p-2 text-error transition-all hover:bg-error-container/30"
              aria-label="Logout"
            >
              <span className="material-symbols-outlined" aria-hidden>
                logout
              </span>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="pt-[92px]">{children}</main>

      <Footer />
    </div>
  );
}
