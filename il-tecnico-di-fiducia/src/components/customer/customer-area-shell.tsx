"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { InactivityTimeoutProvider } from "@/components/auth/inactivity-timeout-provider";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeaderBackButton } from "@/components/navigation/header-back-button";
import { Footer } from "@/components/site/footer";

type CustomerAreaShellProps = {
  children: ReactNode;
};

function customerNavTextClass(active: boolean) {
  return [
    "font-label-md text-label-md font-bold transition-colors",
    active
      ? "text-[#FF8500] underline decoration-[#FF8500] decoration-2 underline-offset-8"
      : "text-on-surface-variant hover:text-on-tertiary-container",
  ].join(" ");
}

function customerIconClass(active: boolean) {
  return [
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all hover:bg-surface-container-high sm:h-11 sm:w-11 md:h-12 md:w-12 md:[&_.material-symbols-outlined]:text-[24px] lg:h-16 lg:w-16 lg:[&_.material-symbols-outlined]:text-[32px]",
    active ? "bg-[#FF8500]/10 text-[#FF8500]" : "text-primary",
  ].join(" ");
}

export function CustomerAreaShell({ children }: CustomerAreaShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isCustomerHome = pathname === "/customer" || pathname === "/cliente";
  const isMessagesActive =
    (isCustomerHome && searchParams.get("section") === "messages") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/");
  const isSettingsActive = pathname === "/customer/impostazioni";
  const [homeSection, setHomeSection] = useState<"search" | "requests">(
    "search",
  );

  useEffect(() => {
    if (!isCustomerHome || isMessagesActive) return;

    function syncHomeSection() {
      const requests = document.getElementById("richieste");

      if (!requests) {
        setHomeSection("search");
        return;
      }

      const headerOffset = window.innerWidth >= 640 ? 112 : 96;
      const requestsTop = requests.getBoundingClientRect().top;

      setHomeSection(requestsTop <= headerOffset ? "requests" : "search");
    }

    syncHomeSection();

    window.addEventListener("scroll", syncHomeSection, { passive: true });
    window.addEventListener("resize", syncHomeSection);
    window.addEventListener("hashchange", syncHomeSection);

    return () => {
      window.removeEventListener("scroll", syncHomeSection);
      window.removeEventListener("resize", syncHomeSection);
      window.removeEventListener("hashchange", syncHomeSection);
    };
  }, [isCustomerHome, isMessagesActive]);

  const isSearchActive =
    isCustomerHome && !isMessagesActive && homeSection === "search";
  const isRequestsActive =
    isCustomerHome && !isMessagesActive && homeSection === "requests";

  return (
    <InactivityTimeoutProvider role="customer">
      <div className="min-h-dvh bg-surface text-on-surface">
        <header className="fixed top-0 z-50 h-20 w-full bg-surface-container-lowest/88 shadow-sm backdrop-blur-md sm:h-[92px]">
          <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 lg:-ml-4 xl:-ml-8 2xl:-ml-12">
              <HeaderBackButton
                fallbackHref="/customer"
                hiddenPathnames={["/customer", "/cliente"]}
              />
              <Link
                href="/customer"
                className="flex min-w-0 items-center gap-2 sm:gap-2.5"
              >
                <Image
                  src="/img/logo-mark.png"
                  alt="Il Tecnico di Fiducia"
                  width={54}
                  height={54}
                  className="h-10 w-10 shrink-0 object-contain sm:h-[54px] sm:w-[54px]"
                  priority
                />
                <span className="block min-w-0 leading-none">
                  <span className="block whitespace-nowrap font-headline-sm text-[13px] font-bold text-primary min-[390px]:text-[15px] sm:text-[21px]">
                    Il tecnico
                  </span>
                  <span className="block whitespace-nowrap font-headline-sm text-[9px] font-bold uppercase tracking-[0.06em] text-[#FF8500] min-[390px]:text-[10px] sm:text-[14px]">
                    di fiducia
                  </span>
                </span>
              </Link>
            </div>

            <nav className="hidden items-center gap-8 lg:flex">
              <Link
                href="/customer#esplora"
                className={customerNavTextClass(isSearchActive)}
                onClick={() => setHomeSection("search")}
              >
                Cerca
              </Link>
              <Link
                href="/customer#richieste"
                className={customerNavTextClass(isRequestsActive)}
                onClick={() => setHomeSection("requests")}
              >
                Richieste
              </Link>
            </nav>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href="/customer#esplora"
                className={customerIconClass(isSearchActive)}
                title="Cerca"
                aria-label="Vai alla ricerca professionisti"
                onClick={() => setHomeSection("search")}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  search
                </span>
              </Link>
              <Link
                href="/customer"
                className={customerIconClass(false)}
                title="Preferiti"
                aria-label="Apri preferiti"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  favorite
                </span>
              </Link>
              <Link
                href="/customer?section=messages"
                className={customerIconClass(isMessagesActive)}
                title="Messaggi"
                aria-label="Apri messaggi"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  chat
                </span>
              </Link>
              <Link
                href="/customer/impostazioni"
                className={customerIconClass(isSettingsActive)}
                title="Impostazioni"
                aria-label="Apri impostazioni account"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  settings
                </span>
              </Link>
              <SignOutButton
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-error transition-all hover:bg-error-container/30 disabled:cursor-wait disabled:opacity-80 sm:h-11 sm:w-11 md:h-12 md:w-12 md:[&_.material-symbols-outlined]:text-[24px] lg:h-16 lg:w-16 lg:[&_.material-symbols-outlined]:text-[32px]"
                aria-label="Logout"
                loadingPresentation="compact"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  logout
                </span>
              </SignOutButton>
            </div>
          </div>
        </header>

        <main className="pt-20 sm:pt-[92px]">{children}</main>

        <Footer />
      </div>
    </InactivityTimeoutProvider>
  );
}
