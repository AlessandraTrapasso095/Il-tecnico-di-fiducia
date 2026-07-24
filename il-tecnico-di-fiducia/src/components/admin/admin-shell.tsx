"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { InactivityTimeoutProvider } from "@/components/auth/inactivity-timeout-provider";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeaderBackButton } from "@/components/navigation/header-back-button";

type AdminShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  adminName?: string;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/clienti", label: "Clienti", icon: "groups" },
  { href: "/admin/professionisti", label: "Professionisti", icon: "engineering" },
  { href: "/admin/scontistiche", label: "Scontistiche", icon: "percent" },
  { href: "/admin/categorie", label: "Categorie", icon: "category" },
  { href: "/admin/admin", label: "Admin", icon: "shield_person" },
  { href: "/admin/supporto", label: "Supporto", icon: "support_agent" },
  { href: "/admin/impostazioni", label: "Impostazioni", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, title, subtitle, adminName }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const navigation = (
    <nav className="space-y-2">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 font-label-md transition focus:outline-none focus:ring-4 focus:ring-primary/20",
              active
                ? "bg-primary text-white shadow-lg shadow-primary/15"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
            ].join(" ")}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="material-symbols-outlined shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <InactivityTimeoutProvider role="admin">
    <div className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface-container-lowest/85 backdrop-blur-xl lg:ml-72">
        <div className="flex min-h-20 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 text-primary transition hover:bg-surface-container-high focus:outline-none focus:ring-4 focus:ring-primary/20 lg:hidden"
              aria-label="Apri menu amministrazione"
              aria-controls="admin-mobile-menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <HeaderBackButton
              fallbackHref="/admin"
              hiddenPathnames={["/admin"]}
              className="mt-1 hidden lg:hidden"
            />
            <div>
              <p className="font-label-md text-sm uppercase tracking-[0.16em] text-[#FF8500]">
                Admin Panel
              </p>
              <h1 className="font-headline-md text-2xl leading-tight text-primary sm:text-[30px]">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full border border-outline-variant/40 bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant sm:block">
              {adminName || "Admin"}
            </div>
            <Link
              href="/admin/impostazioni"
              className={[
                "inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/30 text-primary transition hover:bg-surface-container-high",
                isActive(pathname, "/admin/impostazioni") ? "bg-primary-fixed" : "",
              ].join(" ")}
              aria-label="Apri impostazioni account"
              title="Impostazioni"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </Link>
            <SignOutButton className="inline-flex min-h-11 items-center gap-2 rounded-full border border-error/30 px-4 py-2 font-button text-error transition hover:bg-error-container">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="hidden sm:inline">Esci</span>
            </SignOutButton>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-0 z-50 hidden h-dvh w-72 border-r border-outline-variant/30 bg-surface-container-low p-5 lg:flex lg:flex-col">
        <div className="mb-8 -ml-2 flex items-center justify-between gap-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
              <span className="material-symbols-outlined">admin_panel_settings</span>
            </span>
            <span>
              <span className="block font-headline-sm text-[22px] leading-none text-primary">
                Il Tecnico
              </span>
              <span className="block font-label-md text-[#FF8500]">Admin</span>
            </span>
          </Link>
          <HeaderBackButton fallbackHref="/admin" hiddenPathnames={["/admin"]} />
        </div>

        {navigation}

        <div className="mt-auto rounded-[24px] border border-outline-variant/30 bg-white/60 p-4 text-sm text-on-surface-variant">
          Tutte le azioni sensibili passano da API protette con ruolo admin.
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-inverse-surface/45 backdrop-blur-sm"
            aria-label="Chiudi menu amministrazione"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="admin-mobile-menu"
            className="absolute bottom-0 left-0 top-0 flex w-[min(86vw,22rem)] flex-col overflow-y-auto border-r border-outline-variant/30 bg-surface-container-lowest p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between gap-3 pt-[max(0.25rem,env(safe-area-inset-top))]">
              <Link href="/admin" className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-headline-sm text-[21px] leading-none text-primary">
                    Il Tecnico
                  </span>
                  <span className="block truncate font-label-md text-[#FF8500]">Admin</span>
                </span>
              </Link>
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 text-primary transition hover:bg-surface-container-high focus:outline-none focus:ring-4 focus:ring-primary/20"
                aria-label="Chiudi menu amministrazione"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {navigation}

            <div className="mt-auto pt-6">
              <SignOutButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-error/30 px-4 py-3 font-button text-error transition hover:bg-error-container">
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Logout
              </SignOutButton>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-72 lg:px-8 lg:py-6 lg:pb-10">
        {children}
      </main>
    </div>
    </InactivityTimeoutProvider>
  );
}
