"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <div className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface-container-lowest/85 backdrop-blur-xl lg:ml-72">
        <div className="flex min-h-20 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <HeaderBackButton
              fallbackHref="/admin"
              hiddenPathnames={["/admin"]}
              className="mt-1 lg:hidden"
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
            <SignOutButton className="inline-flex min-h-11 items-center gap-2 rounded-full border border-error/30 px-4 py-2 font-button text-error transition hover:bg-error-container">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Esci
            </SignOutButton>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-0 z-50 hidden h-dvh w-72 border-r border-outline-variant/30 bg-surface-container-low p-5 lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-2 px-2">
          <HeaderBackButton fallbackHref="/admin" hiddenPathnames={["/admin"]} />
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
        </div>

        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-2xl px-4 py-3 font-label-md transition",
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/15"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
                ].join(" ")}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] border border-outline-variant/30 bg-white/60 p-4 text-sm text-on-surface-variant">
          Tutte le azioni sensibili passano da API protette con ruolo admin.
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex gap-1 overflow-x-auto border-t border-outline-variant/30 bg-surface-container-lowest/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-w-[76px] flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px]",
                active ? "text-primary" : "text-on-surface-variant",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-72 lg:px-8 lg:py-6 lg:pb-10">
        {children}
      </main>
    </div>
  );
}
