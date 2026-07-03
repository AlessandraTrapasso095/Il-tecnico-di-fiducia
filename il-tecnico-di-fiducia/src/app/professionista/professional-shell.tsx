"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Footer } from "@/components/site/footer";
import { fetchJson } from "@/lib/api/fetch-json";

type ProfessionalShellProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  avatar_url?: string | null;
};

type NotificationRow = {
  id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
  href: string;
  actor: {
    id: string;
    role: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  entity?: {
    id: string;
    subject: string;
  } | null;
};

type NotificationsResponse = {
  notifications: NotificationRow[];
};

type ProfessionalSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
};

type ProfessionalsResponse = {
  total: number;
  professionals: ProfessionalSearchRow[];
};

type ProfessionalShellProps = {
  profile: ProfessionalShellProfile;
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/professionista", label: "Dashboard", icon: "dashboard" },
  { href: "/professionista/seguiti", label: "Seguiti", icon: "groups" },
  { href: "/professionista/messaggi", label: "Messaggi e Richieste", icon: "forum" },
  { href: "/professionista/impostazioni", label: "Impostazioni", icon: "settings" },
  { href: "/professionista/abbonamento", label: "Abbonamento", icon: "workspace_premium" },
  { href: "/professionista/supporto", label: "Supporto", icon: "help" },
] as const;

function fullName(person: { first_name: string; last_name: string } | null | undefined) {
  if (!person) return "Utente";
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Utente";
}

function initials(person: { first_name: string; last_name: string }) {
  const first = person.first_name.trim().slice(0, 1).toUpperCase();
  const last = person.last_name.trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "P";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationText(notification: NotificationRow) {
  const actor = fullName(notification.actor);

  if (notification.type === "follow_started") {
    return `${actor} ha iniziato a seguirti`;
  }

  if (notification.type === "post_commented") {
    return `${actor} ha commentato il tuo post`;
  }

  if (notification.type === "post_liked") {
    return `${actor} ha messo like al tuo post`;
  }

  if (notification.type === "contact_request_created") {
    return `${actor} ti ha inviato una richiesta`;
  }

  if (notification.type === "contact_request_accepted") {
    return `${actor} ha accettato la richiesta`;
  }

  if (notification.type === "contact_request_rejected") {
    return `${actor} ha rifiutato la richiesta`;
  }

  if (notification.type === "review_created") {
    return `${actor} ha lasciato una recensione`;
  }

  if (notification.type === "support_ticket_replied") {
    return notification.entity?.subject
      ? `Hai ricevuto una risposta al ticket: ${notification.entity.subject}`
      : "Hai ricevuto una risposta al tuo ticket";
  }

  if (notification.type === "support_ticket_user_replied") {
    return notification.entity?.subject
      ? `${actor} ha risposto al ticket: ${notification.entity.subject}`
      : `${actor} ha risposto a un ticket`;
  }

  if (notification.type === "support_ticket_resolved") {
    return notification.entity?.subject
      ? `Il ticket ${notification.entity.subject} è stato segnato come risolto`
      : "Il tuo ticket è stato segnato come risolto";
  }

  return "Nuova notifica";
}

function Avatar({
  person,
  size = "sm",
}: {
  person: { first_name: string; last_name: string; avatar_url?: string | null };
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-12 w-12" : "h-10 w-10";

  if (person.avatar_url) {
    return (
      <Image
        src={person.avatar_url}
        alt={fullName(person)}
        width={48}
        height={48}
        unoptimized
        className={`${sizeClass} rounded-full border-2 border-primary-container object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white`}
    >
      {initials(person)}
    </div>
  );
}

function LogoWordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 sm:gap-3" aria-label="Vai alla landing">
      <Image
        src="/img/logo-mark.png"
        alt="Il Tecnico di Fiducia"
        width={80}
        height={80}
        className="h-12 w-12 object-contain sm:h-14 sm:w-14"
        priority
      />
      <span className="flex flex-col leading-none">
        <span className="font-headline-sm text-[19px] font-bold text-primary sm:text-[22px]">
          Il tecnico
        </span>
        <span className="font-label-md text-[11px] font-extrabold uppercase tracking-[0.13em] text-on-tertiary-container sm:text-[12px]">
          di fiducia
        </span>
      </span>
    </Link>
  );
}

export default function ProfessionalShell({ profile, children }: ProfessionalShellProps) {
  const pathname = usePathname();
  const [shellProfile, setShellProfile] = useState(profile);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfessionalSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  useEffect(() => {
    function onAvatarUpdated(event: Event) {
      const avatarUrl = (event as CustomEvent<{ avatar_url?: string | null }>).detail
        ?.avatar_url;
      if (avatarUrl === undefined) return;
      setShellProfile((current) => ({ ...current, avatar_url: avatarUrl }));
    }

    window.addEventListener("professional-avatar-updated", onAvatarUpdated);
    return () => {
      window.removeEventListener("professional-avatar-updated", onAvatarUpdated);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchJson<NotificationsResponse>("/api/notifications?limit=10", { method: "GET" })
      .then((response) => {
        if (!mounted) return;
        setNotifications(response.notifications ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setNotifications([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const query = searchQuery.replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      return;
    }

    let mounted = true;
    const handle = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      fetchJson<ProfessionalsResponse>(
        `/api/professionals?q=${encodeURIComponent(query)}&page_size=8`,
        { method: "GET" },
      )
        .then((response) => {
          if (!mounted) return;
          setSearchResults(response.professionals ?? []);
        })
        .catch((err) => {
          if (!mounted) return;
          setSearchError(err instanceof Error ? err.message : "Ricerca non disponibile.");
        })
        .finally(() => {
          if (!mounted) return;
          setSearchLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    if (!notificationsOpen && !searchOpen) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (notificationsOpen && !notificationsRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }

      if (searchOpen && !searchRef.current?.contains(target)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notificationsOpen, searchOpen]);

  async function markNotificationsRead() {
    const ids = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);
    if (ids.length === 0) return;

    await fetchJson<{ ok: true }>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id)
          ? { ...notification, read_at: new Date().toISOString() }
          : notification,
      ),
    );
  }

  async function markNotificationRead(notificationId: string) {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.read_at) return;

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    );

    try {
      await fetchJson<{ ok: true }>("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids: [notificationId] }),
      });
    } catch {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read_at: target.read_at }
            : notification,
        ),
      );
    }
  }

  const sidebar = (
    <nav className="flex flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/professionista"
            ? pathname === item.href
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center gap-3 rounded-2xl px-4 py-3 font-label-md transition",
              active
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
            ].join(" ")}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
      <SignOutButton className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-label-md text-error transition hover:bg-error-container/40">
        <span className="material-symbols-outlined">logout</span>
        Esci
      </SignOutButton>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="fixed left-0 right-0 top-0 z-50 h-20 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2 text-primary hover:bg-surface-container-high lg:hidden"
              aria-label="Apri menu"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <LogoWordmark />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div ref={searchRef} className="relative">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full text-primary transition hover:bg-surface-container-high"
                aria-label="Cerca professionisti"
                onClick={() => {
                  setSearchOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
              >
                <span className="material-symbols-outlined">search</span>
              </button>
              {searchOpen ? (
                <div className="absolute right-0 top-[56px] w-[min(440px,calc(100vw-32px))] rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-2xl">
                  <label className="font-label-md text-primary" htmlFor="professional-search">
                    Cerca altri professionisti
                  </label>
                  <div className="relative mt-3">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                      search
                    </span>
                    <input
                      id="professional-search"
                      className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest py-3 pl-12 pr-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={searchQuery}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSearchQuery(value);
                        if (value.trim().length < 2) {
                          setSearchResults([]);
                          setSearchError(null);
                        }
                      }}
                      placeholder="Nome, cognome o specializzazione"
                    />
                  </div>
                  <div className="mt-4 max-h-[420px] space-y-3 overflow-auto">
                    {searchQuery.trim().length < 2 ? (
                      <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Scrivi almeno 2 caratteri per cercare professionisti iscritti.
                      </p>
                    ) : null}
                    {searchLoading ? (
                      <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Ricerca in corso…
                      </p>
                    ) : null}
                    {searchError ? (
                      <p className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
                        {searchError}
                      </p>
                    ) : null}
                    {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                      <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Nessun professionista trovato.
                      </p>
                    ) : null}
                    {searchResults.map((professional) => (
                      <Link
                        key={professional.id}
                        href={`/professionisti/${professional.id}`}
                        className="flex gap-3 rounded-2xl bg-surface-container-low p-3"
                        onClick={() => setSearchOpen(false)}
                      >
                        <Avatar person={professional} />
                        <div className="min-w-0">
                          <div className="font-label-md text-primary">
                            {fullName(professional)}
                          </div>
                          <div className="line-clamp-2 text-sm text-on-surface-variant">
                            {professional.headline ?? "Profilo professionista"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {professional.province_code ? (
                              <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed-variant">
                                {professional.province_code}
                              </span>
                            ) : null}
                            {professional.available_remote ? (
                              <span className="rounded-full bg-secondary-fixed px-2.5 py-1 text-[11px] font-bold text-on-secondary-fixed-variant">
                                Remoto
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-primary transition hover:bg-surface-container-high"
                aria-label="Notifiche"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setSearchOpen(false);
                }}
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadNotifications > 0 ? (
                  <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8500] px-1 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-[56px] w-[min(380px,calc(100vw-32px))] rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-headline-sm text-[20px] text-primary">Notifiche</div>
                    <button
                      type="button"
                      className="text-xs font-bold text-primary hover:underline"
                      onClick={() => void markNotificationsRead()}
                    >
                      Segna lette
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      Nessuna notifica.
                    </p>
                  ) : (
                    <div className="max-h-[360px] space-y-2 overflow-auto">
                      {notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={notification.href}
                          className="flex gap-3 rounded-2xl bg-surface-container-low p-3 text-sm transition hover:bg-surface-container"
                          onClick={() => {
                            setNotificationsOpen(false);
                            void markNotificationRead(notification.id);
                          }}
                        >
                          <Avatar
                            person={
                              notification.actor ?? {
                                first_name: "Il Tecnico",
                                last_name: "",
                                avatar_url: null,
                              }
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="font-label-md text-primary">
                                {notificationText(notification)}
                              </span>
                              {!notification.read_at ? (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF8500]" />
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-on-surface-variant">
                              {formatTime(notification.created_at)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <Link
              href="/professionista/profilo"
              className="rounded-full transition hover:scale-95"
              aria-label="Vai al profilo professionista"
            >
              <Avatar person={shellProfile} />
            </Link>
          </div>
        </div>

      </header>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[60] bg-inverse-surface/45 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[min(320px,86vw)] bg-surface-container-low p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <LogoWordmark />
              <button
                type="button"
                className="rounded-full p-2 text-primary hover:bg-surface-container-high"
                aria-label="Chiudi menu"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div onClick={() => setSidebarOpen(false)}>{sidebar}</div>
          </div>
        </div>
      ) : null}

      <div className="pt-20 lg:flex lg:items-start">
        <aside className="sticky top-20 hidden h-[calc(100vh-80px)] w-[280px] shrink-0 flex-col border-r border-outline-variant/30 bg-surface-container-low px-4 py-6 lg:flex">
          <div className="mb-8 px-2">
            <p className="font-headline-sm text-[22px] text-primary">Il Tecnico</p>
            <p className="font-label-md text-[12px] text-on-surface-variant">
              Account Professionista
            </p>
          </div>
          {sidebar}
        </aside>

        <main className="min-h-[calc(100vh-80px)] min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
