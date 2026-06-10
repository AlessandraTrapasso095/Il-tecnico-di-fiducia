"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Footer } from "@/components/site/footer";
import { fetchJson } from "@/lib/api/fetch-json";

type ProfessionalProfileLite = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
};

type SubscriptionStatus = "none" | "stripe_active" | "admin_forced_active" | "suspended";

type SubscriptionResponse = {
  subscription: {
    professional_id: string;
    status: SubscriptionStatus;
    current_period_end: string | null;
    updated_at: string | null;
  } | null;
  is_active: boolean;
};

type PostAuthor = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  province_code: string | null;
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  author: PostAuthor | null;
};

type PostsResponse = {
  posts: PostRow[];
};

type NotificationRow = {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
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

type ProfessionalDashboardClientProps = {
  profile: ProfessionalProfileLite;
};

const SUBSCRIPTION_SETTINGS_PATH = "/professionista/impostazioni/abbonamento";

function fullName(person: { first_name: string; last_name: string } | null | undefined) {
  if (!person) return "Utente";
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Utente";
}

function initials(person: { first_name: string; last_name: string }) {
  const first = person.first_name.trim().slice(0, 1).toUpperCase();
  const last = person.last_name.trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "P";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Nessun messaggio";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function subscriptionCardCopy(
  subscription: SubscriptionResponse | null,
): {
  title: string;
  body: string;
  dateLabel: string;
  buttonLabel: string;
  className: string;
  iconClassName: string;
  icon: string;
} {
  const status = subscription?.subscription?.status ?? "none";

  if (status === "stripe_active") {
    return {
      title: "Abbonamento attivo",
      body: "Il profilo è visibile e contattabile dai clienti secondo le regole piattaforma.",
      dateLabel: "Prossimo rinnovo",
      buttonLabel: "Gestisci abbonamento",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconClassName: "bg-emerald-500 text-white",
      icon: "verified",
    };
  }

  if (status === "admin_forced_active") {
    return {
      title: "Abbonamento attivo forzato da admin",
      body: "La visibilità è stata abilitata manualmente da un amministratore.",
      dateLabel: "Fine/rinnovo",
      buttonLabel: "Gestisci abbonamento",
      className: "border-lime-200 bg-lime-50 text-lime-950",
      iconClassName: "bg-lime-600 text-white",
      icon: "admin_panel_settings",
    };
  }

  if (status === "suspended") {
    return {
      title: "Abbonamento sospeso",
      body: "Riattiva l’abbonamento per tornare visibile e contattabile dai clienti.",
      dateLabel: "Fine ultimo periodo",
      buttonLabel: "Riattiva abbonamento",
      className: "border-amber-200 bg-amber-50 text-amber-950",
      iconClassName: "bg-amber-500 text-white",
      icon: "pause_circle",
    };
  }

  return {
    title: "Abbonamento non attivo",
    body: "Abbonati per farti vedere e contattare dai clienti.",
    dateLabel: "Scadenza",
    buttonLabel: "Attiva abbonamento",
    className: "border-red-200 bg-red-50 text-red-950",
    iconClassName: "bg-red-600 text-white",
    icon: "visibility_off",
  };
}

function Avatar({
  person,
  size = "md",
}: {
  person: { first_name: string; last_name: string; avatar_url?: string | null };
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-10 w-10" : "h-12 w-12";

  if (person.avatar_url) {
    return (
      <Image
        src={person.avatar_url}
        alt={fullName(person)}
        width={56}
        height={56}
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
    <Link href="/professionista" className="flex items-center gap-3">
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

export default function ProfessionalDashboardClient({
  profile,
}: ProfessionalDashboardClientProps) {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfessionalSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [postBody, setPostBody] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const subscriptionCopy = subscriptionCardCopy(subscription);
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;

  const fetchDashboardData = useCallback(async () => {
    const [subscriptionRes, postsRes, notificationsRes] = await Promise.all([
      fetchJson<SubscriptionResponse>("/api/subscription", { method: "GET" }),
      fetchJson<PostsResponse>("/api/posts?feed=following&page_size=30", {
        method: "GET",
      }),
      fetchJson<NotificationsResponse>("/api/notifications?limit=10", {
        method: "GET",
      }),
    ]);

    return {
      subscriptionRes,
      postsRes,
      notificationsRes,
    };
  }, []);

  const applyDashboardData = useCallback((data: Awaited<ReturnType<typeof fetchDashboardData>>) => {
    setSubscription(data.subscriptionRes);
    setPosts(data.postsRes.posts ?? []);
    setNotifications(data.notificationsRes.notifications ?? []);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      applyDashboardData(await fetchDashboardData());
    } finally {
      setLoading(false);
    }
  }, [applyDashboardData, fetchDashboardData]);

  useEffect(() => {
    let mounted = true;

    fetchDashboardData()
      .then((data) => {
        if (!mounted) return;
        applyDashboardData(data);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [applyDashboardData, fetchDashboardData]);

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

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError(null);

    const body = postBody.replace(/\s+/g, " ").trim();
    if (!body) {
      setPostError("Scrivi qualcosa prima di pubblicare.");
      return;
    }

    if (photoFiles.length > 0 || videoFiles.length > 0) {
      setPostError(
        "I file sono selezionati correttamente, ma l’API media dei post non è ancora disponibile: rimuovili per pubblicare solo testo.",
      );
      return;
    }

    setPosting(true);
    try {
      await fetchJson<{ post: PostRow }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setPostBody("");
      setPhotoFiles([]);
      setVideoFiles([]);
      await loadDashboard();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Impossibile creare il post.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: PostRow) {
    setBusyPostId(post.id);
    try {
      await fetchJson<{ ok: true }>(`/api/posts/${post.id}/likes`, {
        method: post.liked_by_me ? "DELETE" : "POST",
      });
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: !post.liked_by_me,
                likes_count: Math.max(
                  0,
                  item.likes_count + (post.liked_by_me ? -1 : 1),
                ),
              }
            : item,
        ),
      );
    } finally {
      setBusyPostId(null);
    }
  }

  async function addComment(postId: string) {
    const body = (commentDrafts[postId] ?? "").replace(/\s+/g, " ").trim();
    if (!body) return;

    setBusyPostId(postId);
    try {
      await fetchJson<{ comment: unknown }>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments_count: post.comments_count + 1 }
            : post,
        ),
      );
    } finally {
      setBusyPostId(null);
    }
  }

  async function savePostEdit(postId: string) {
    const body = editBody.replace(/\s+/g, " ").trim();
    if (!body) return;

    setBusyPostId(postId);
    try {
      const response = await fetchJson<{ post: PostRow }>(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, body: response.post.body, updated_at: response.post.updated_at }
            : post,
        ),
      );
      setEditingPostId(null);
      setEditBody("");
    } finally {
      setBusyPostId(null);
    }
  }

  async function deletePost(postId: string) {
    if (!window.confirm("Vuoi eliminare questo post?")) return;

    setBusyPostId(postId);
    try {
      await fetchJson<{ ok: true }>(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((current) => current.filter((post) => post.id !== postId));
    } finally {
      setBusyPostId(null);
    }
  }

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

  const sidebar = (
    <nav className="flex flex-col gap-2">
      <Link
        href="/professionista"
        className="flex items-center gap-3 rounded-2xl bg-primary-container px-4 py-3 font-label-md text-on-primary-container"
      >
        <span className="material-symbols-outlined">dashboard</span>
        Dashboard
      </Link>
      <Link
        href="/messages"
        className="flex items-center gap-3 rounded-2xl px-4 py-3 font-label-md text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
      >
        <span className="material-symbols-outlined">forum</span>
        Messaggi e Richieste
      </Link>
      <Link
        href={SUBSCRIPTION_SETTINGS_PATH}
        className="flex items-center gap-3 rounded-2xl px-4 py-3 font-label-md text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
      >
        <span className="material-symbols-outlined">settings</span>
        Impostazioni e Abbonamento
      </Link>
      <a
        href="#supporto"
        className="flex items-center gap-3 rounded-2xl px-4 py-3 font-label-md text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
      >
        <span className="material-symbols-outlined">help</span>
        Supporto
      </a>
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
            <a
              href="#home"
              className="rounded-full transition hover:scale-95"
              aria-label="Vai al profilo professionista"
            >
              <Avatar person={profile} size="sm" />
            </a>
          </div>
        </div>

        {notificationsOpen ? (
          <div className="absolute right-4 top-[72px] w-[min(380px,calc(100vw-32px))] rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-2xl">
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
                  <div
                    key={notification.id}
                    className="rounded-2xl bg-surface-container-low p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {!notification.read_at ? (
                        <span className="h-2 w-2 rounded-full bg-[#FF8500]" />
                      ) : null}
                      <span className="font-label-md text-primary">{notification.type}</span>
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {searchOpen ? (
          <div className="absolute right-4 top-[72px] w-[min(440px,calc(100vw-32px))] rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-2xl">
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
                <div
                  key={professional.id}
                  className="flex gap-3 rounded-2xl bg-surface-container-low p-3"
                >
                  <Avatar person={professional} size="sm" />
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
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <aside className="fixed bottom-0 left-0 top-20 hidden w-[280px] flex-col border-r border-outline-variant/30 bg-surface-container-low px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <p className="font-headline-sm text-[22px] text-primary">Il Tecnico</p>
          <p className="font-label-md text-[12px] text-on-surface-variant">
            Account Professionista
          </p>
        </div>
        {sidebar}
      </aside>

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

      <main id="home" className="pt-20 lg:pl-[280px]">
        <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8">
          <section
            className={`mb-6 rounded-[28px] border p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6 ${subscriptionCopy.className}`}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${subscriptionCopy.iconClassName}`}
                >
                  <span className="material-symbols-outlined">{subscriptionCopy.icon}</span>
                </div>
                <div>
                  <h1 className="font-headline-sm text-[22px] sm:text-headline-sm">
                    {subscriptionCopy.title}
                  </h1>
                  <p className="mt-1 max-w-2xl font-body-md text-body-md opacity-85">
                    {subscriptionCopy.body}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl bg-white/65 px-4 py-3 text-sm">
                  <div className="font-label-md text-[11px] uppercase tracking-[0.14em] opacity-70">
                    {subscriptionCopy.dateLabel}
                  </div>
                  <div className="font-button">
                    {formatDate(subscription?.subscription?.current_period_end)}
                  </div>
                </div>
                <Link
                  href={SUBSCRIPTION_SETTINGS_PATH}
                  className="rounded-full bg-[#FF8500] px-6 py-3 text-center font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B]"
                >
                  {subscriptionCopy.buttonLabel}
                </Link>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <form
              onSubmit={createPost}
              className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6"
            >
              <div className="flex gap-4">
                <Avatar person={profile} size="sm" />
                <div className="flex-1">
                  <label className="sr-only" htmlFor="post-body">
                    Crea un post
                  </label>
                  <textarea
                    id="post-body"
                    className="min-h-24 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={postBody}
                    onChange={(event) => setPostBody(event.target.value)}
                    placeholder="Condividi un aggiornamento professionale..."
                    maxLength={1200}
                  />
                </div>
              </div>
              {postError ? (
                <div className="mt-3 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
                  {postError}
                </div>
              ) : null}
              {(photoFiles.length > 0 || videoFiles.length > 0) ? (
                <div className="mt-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  <span className="font-bold text-primary">File selezionati:</span>{" "}
                  {[...photoFiles, ...videoFiles].map((file) => file.name).join(", ")}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-4 border-t border-outline-variant/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="post-photos"
                    className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-secondary transition hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[20px]">image</span>
                    Foto
                  </label>
                  <input
                    id="post-photos"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
                  />
                  <label
                    htmlFor="post-videos"
                    className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-secondary transition hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                    Video
                  </label>
                  <input
                    id="post-videos"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    multiple
                    className="sr-only"
                    onChange={(event) => setVideoFiles(Array.from(event.target.files ?? []))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-sm text-on-surface-variant">
                    {postBody.trim().length}/1200
                  </span>
                  <button
                    type="submit"
                    disabled={posting}
                    className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:opacity-60"
                  >
                    {posting ? "Pubblicazione…" : "Pubblica"}
                  </button>
                </div>
              </div>
            </form>

            <div className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
                    Feed
                  </span>
                  <h2 className="font-headline-md text-headline-md text-primary">
                    Post dei professionisti
                  </h2>
                </div>
                {loading ? (
                  <span className="text-sm text-on-surface-variant">Caricamento…</span>
                ) : null}
              </div>

              {posts.length === 0 ? (
                <div className="rounded-[24px] border-2 border-dashed border-outline-variant p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined">article</span>
                  </div>
                  <h3 className="mt-4 font-headline-sm text-[22px] text-primary">
                    Nessun post ancora
                  </h3>
                  <p className="mx-auto mt-2 w-full max-w-[560px] text-balance text-on-surface-variant">
                    Qui compariranno i tuoi post e quelli dei professionisti che segui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const isAuthor = post.author_id === profile.id;
                    return (
                      <article
                        key={post.id}
                        className="rounded-[24px] border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5"
                      >
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <Avatar
                              person={
                                post.author ?? {
                                  first_name: "Professionista",
                                  last_name: "",
                                  avatar_url: null,
                                }
                              }
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="font-label-md text-primary">
                                {fullName(post.author)}
                              </div>
                              <div className="line-clamp-1 text-sm text-on-surface-variant">
                                {post.author?.headline ?? "Professionista"}
                              </div>
                              <div className="mt-1 text-xs text-on-surface-variant">
                                {formatTime(post.created_at)}
                              </div>
                            </div>
                          </div>

                          {isAuthor ? (
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                className="rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary-fixed"
                                onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditBody(post.body);
                                }}
                              >
                                Modifica
                              </button>
                              <button
                                type="button"
                                className="rounded-full px-3 py-2 text-sm font-bold text-error hover:bg-error-container/40"
                                disabled={busyPostId === post.id}
                                onClick={() => void deletePost(post.id)}
                              >
                                Elimina
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {editingPostId === post.id ? (
                          <div className="space-y-3">
                            <textarea
                              className="min-h-28 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                              value={editBody}
                              onChange={(event) => setEditBody(event.target.value)}
                              maxLength={1200}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="rounded-full px-5 py-2.5 font-button text-primary hover:bg-primary-fixed"
                                onClick={() => {
                                  setEditingPostId(null);
                                  setEditBody("");
                                }}
                              >
                                Annulla
                              </button>
                              <button
                                type="button"
                                disabled={busyPostId === post.id}
                                className="rounded-full bg-primary px-5 py-2.5 font-button text-white disabled:opacity-60"
                                onClick={() => void savePostEdit(post.id)}
                              >
                                Salva
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">
                            {post.body}
                          </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-outline-variant/30 pt-4">
                          <button
                            type="button"
                            disabled={busyPostId === post.id}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                              post.liked_by_me
                                ? "bg-primary text-white"
                                : "bg-surface-container-lowest text-primary hover:bg-primary-fixed"
                            }`}
                            onClick={() => void toggleLike(post)}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              thumb_up
                            </span>
                            Mi piace · {post.likes_count}
                          </button>
                          <span className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-sm font-bold text-on-surface-variant">
                            <span className="material-symbols-outlined text-[20px]">
                              chat_bubble
                            </span>
                            Commenti · {post.comments_count}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <input
                            className="min-h-11 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            value={commentDrafts[post.id] ?? ""}
                            onChange={(event) =>
                              setCommentDrafts((current) => ({
                                ...current,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder="Scrivi un commento reale..."
                          />
                          <button
                            type="button"
                            disabled={busyPostId === post.id}
                            className="rounded-full bg-primary px-5 py-2.5 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
                            onClick={() => void addComment(post.id)}
                          >
                            Commenta
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            <section
              id="supporto"
              className="rounded-[28px] border border-outline-variant/30 bg-primary p-6 text-white shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-headline-sm text-[24px]">Supporto</h2>
                  <p className="mt-2 max-w-2xl text-primary-fixed-dim">
                    Per assistenza su profilo, messaggi, richieste o abbonamento usa i
                    canali di supporto della piattaforma.
                  </p>
                </div>
                <Link
                  href="/professionista/impostazioni/abbonamento"
                  className="rounded-full bg-[#FF8500] px-6 py-3 text-center font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B]"
                >
                  Gestisci abbonamento
                </Link>
              </div>
            </section>
          </section>
        </div>
      </main>
      <div className="lg:pl-[280px]">
        <Footer />
      </div>
    </div>
  );
}
