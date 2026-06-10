"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { StartCheckoutButton } from "@/components/billing/start-checkout-button";
import { fetchJson } from "@/lib/api/fetch-json";
import type { ConversationRow } from "@/lib/types/chat";

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

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    headline: string | null;
    province_code: string | null;
  } | null;
};

type PostsResponse = {
  posts: PostRow[];
};

type ContactRequestStatus = "pending" | "accepted" | "rejected";

type ContactRequestRow = {
  id: string;
  customer_id: string;
  subject: string;
  status: ContactRequestStatus;
  created_at: string;
  conversation_id: string | null;
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    province_code: string | null;
  } | null;
};

type ContactRequestsResponse = {
  total: number;
  requests: ContactRequestRow[];
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

type ConversationsResponse = {
  conversations: ConversationRow[];
};

type ProfessionalDashboardClientProps = {
  profile: ProfessionalProfileLite;
};

function fullName(person: { first_name: string; last_name: string } | null | undefined) {
  if (!person) return "Utente";
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Utente";
}

function initials(person: { first_name: string; last_name: string }) {
  const first = person.first_name.trim().slice(0, 1).toUpperCase();
  const last = person.last_name.trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "P";
}

function formatDate(value: string | null) {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "Nessun messaggio";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function subscriptionCopy(status: SubscriptionStatus | null, isActive: boolean) {
  if (status === "stripe_active") {
    return {
      title: "Abbonamento attivo",
      body: "Il profilo può essere visibile ai clienti secondo le regole piattaforma.",
      color: "bg-emerald-50 border-emerald-200 text-emerald-900",
      icon: "bg-emerald-500",
    };
  }

  if (status === "admin_forced_active") {
    return {
      title: "Abbonamento attivo da admin",
      body: "Visibilità abilitata manualmente dall’amministratore.",
      color: "bg-orange-50 border-orange-200 text-orange-900",
      icon: "bg-[#FF8500]",
    };
  }

  if (status === "suspended") {
    return {
      title: "Abbonamento sospeso",
      body: "La visibilità pubblica è sospesa finché lo stato non viene riattivato.",
      color: "bg-amber-50 border-amber-200 text-amber-950",
      icon: "bg-amber-500",
    };
  }

  return {
    title: isActive ? "Abbonamento attivo" : "Abbonamento non attivo",
    body: isActive
      ? "Il profilo risulta abilitato alla visibilità."
      : "Attiva l’abbonamento per rendere il profilo visibile ai nuovi clienti.",
    color: isActive
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : "bg-surface-container-lowest border-outline-variant text-on-surface",
    icon: isActive ? "bg-emerald-500" : "bg-outline",
  };
}

function requestStatusLabel(status: ContactRequestStatus) {
  if (status === "accepted") return "Accettata";
  if (status === "rejected") return "Rifiutata";
  return "In attesa";
}

export default function ProfessionalDashboardClient({
  profile,
}: ProfessionalDashboardClientProps) {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [feedPosts, setFeedPosts] = useState<PostRow[]>([]);
  const [ownPosts, setOwnPosts] = useState<PostRow[]>([]);
  const [requests, setRequests] = useState<ContactRequestRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postError, setPostError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const status = subscription?.subscription?.status ?? "none";
  const subscriptionState = subscriptionCopy(status, subscription?.is_active ?? false);
  const unreadNotifications = notifications.filter((n) => !n.read_at).length;

  const publicProfileState = useMemo(() => {
    if (subscription?.is_active) {
      return {
        label: "Profilo pubblico abilitato",
        body: "Il tuo profilo può comparire nelle ricerche dei clienti.",
        className: "bg-primary-fixed text-on-primary-fixed-variant",
      };
    }

    return {
      label: "Profilo non pubblico",
      body: "Completa o riattiva l’abbonamento per la visibilità ai nuovi clienti.",
      className: "bg-surface-container-high text-on-surface-variant",
    };
  }, [subscription?.is_active]);

  const fetchDashboardData = useCallback(async () => {
    const [subscriptionRes, feedRes, ownRes, requestsRes, conversationsRes, notificationsRes] =
      await Promise.all([
        fetchJson<SubscriptionResponse>("/api/subscription", { method: "GET" }),
        fetchJson<PostsResponse>("/api/posts?feed=following&page_size=20", {
          method: "GET",
        }),
        fetchJson<PostsResponse>(
          `/api/posts?author_id=${encodeURIComponent(profile.id)}&page_size=20`,
          { method: "GET" },
        ),
        fetchJson<ContactRequestsResponse>("/api/contact-requests?page_size=5", {
          method: "GET",
        }),
        fetchJson<ConversationsResponse>("/api/conversations", { method: "GET" }),
        fetchJson<NotificationsResponse>("/api/notifications?limit=8", {
          method: "GET",
        }),
      ]);

    return {
      subscriptionRes,
      feedRes,
      ownRes,
      requestsRes,
      conversationsRes,
      notificationsRes,
    };
  }, [profile.id]);

  const applyDashboardData = useCallback((data: Awaited<ReturnType<typeof fetchDashboardData>>) => {
    setSubscription(data.subscriptionRes);
    setFeedPosts(data.feedRes.posts ?? []);
    setOwnPosts(data.ownRes.posts ?? []);
    setRequests(data.requestsRes.requests ?? []);
    setConversations(data.conversationsRes.conversations ?? []);
    setNotifications(data.notificationsRes.notifications ?? []);
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      applyDashboardData(await fetchDashboardData());
    } finally {
      setLoading(false);
    }
  }

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
  }, [applyDashboardData, fetchDashboardData, profile.id]);

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    setPostError(null);

    const body = postBody.replace(/\s+/g, " ").trim();
    if (!body) {
      setPostError("Scrivi qualcosa prima di pubblicare.");
      return;
    }

    setPosting(true);
    try {
      await fetchJson<{ post: PostRow }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setPostBody("");
      await loadDashboard();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Impossibile creare il post.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 h-[84px] bg-surface-container-lowest/90 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/professionista" className="flex items-center gap-2.5">
            <Image
              src="/img/logo-mark.png"
              alt="Il Tecnico di Fiducia"
              width={96}
              height={96}
              className="h-12 w-12 object-contain"
              priority
            />
            <span className="hidden leading-none sm:flex sm:flex-col">
              <span className="font-headline-sm text-[20px] font-bold text-primary">
                Il tecnico
              </span>
              <span className="font-label-md text-[12px] font-extrabold uppercase tracking-[0.12em] text-on-tertiary-container">
                di fiducia
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a className="font-label-md text-label-md text-on-tertiary-container" href="#home">
              Home
            </a>
            <a className="font-label-md text-label-md text-on-surface-variant" href="#profilo">
              Profilo
            </a>
            <Link className="font-label-md text-label-md text-on-surface-variant" href="/messages">
              Messaggi
            </Link>
            <a
              className="font-label-md text-label-md text-on-surface-variant"
              href="#impostazioni"
            >
              Impostazioni
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative h-11 w-11 rounded-full text-primary hover:bg-surface-container-high"
              aria-label="Notifiche"
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              🔔
              {unreadNotifications > 0 ? (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8500] px-1 text-[10px] font-bold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
            </button>
            <SignOutButton className="hidden rounded-full px-4 py-2 font-button text-button text-error hover:bg-error-container/30 sm:inline-flex">
              Logout
            </SignOutButton>
          </div>
        </div>

        {notificationsOpen ? (
          <div className="absolute right-4 top-[76px] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-2xl">
            <div className="mb-3 font-headline-sm text-[18px] text-primary">Notifiche</div>
            {notifications.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nessuna notifica.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-xl bg-surface-container-low p-3 text-sm"
                  >
                    <div className="font-label-md text-primary">{notification.type}</div>
                    <div className="text-xs text-on-surface-variant">
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </header>

      <main id="home" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className={`rounded-[24px] border p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] ${subscriptionState.color}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${subscriptionState.icon}`}>
                  ✓
                </div>
                <div>
                  <h1 className="font-headline-sm text-[22px]">{subscriptionState.title}</h1>
                  <p className="font-body-md text-body-md opacity-80">{subscriptionState.body}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm">
                <div className="font-label-md uppercase tracking-wider opacity-70">
                  Rinnovo/scadenza
                </div>
                <div className="font-button">{formatDate(subscription?.subscription?.current_period_end ?? null)}</div>
              </div>
            </div>

            {subscription?.is_active ? null : (
              <div className="mt-4">
                <StartCheckoutButton className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white shadow-md hover:bg-[#FF9A2B] disabled:opacity-60">
                  Attiva abbonamento
                </StartCheckoutButton>
              </div>
            )}
          </div>

          <div id="profilo" className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                {initials(profile)}
              </div>
              <div>
                <div className="font-headline-sm text-[20px] text-primary">
                  {fullName(profile)}
                </div>
                <div className="text-sm text-on-surface-variant">{profile.email}</div>
              </div>
            </div>
            <div className={`rounded-2xl p-4 ${publicProfileState.className}`}>
              <div className="font-label-md">{publicProfileState.label}</div>
              <p className="mt-1 text-sm">{publicProfileState.body}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <form
              onSubmit={createPost}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
            >
              <label className="font-headline-sm text-[20px] text-primary">
                Crea un post
              </label>
              <textarea
                className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                placeholder="Condividi aggiornamenti, consigli tecnici o lavori pubblicati..."
                maxLength={1200}
              />
              {postError ? (
                <div className="mt-3 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
                  {postError}
                </div>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface-variant">
                  {postBody.trim().length}/1200
                </span>
                <button
                  type="submit"
                  disabled={posting}
                  className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-md hover:bg-[#FF9A2B] disabled:opacity-60"
                >
                  {posting ? "Pubblicazione…" : "Post"}
                </button>
              </div>
            </form>

            <div className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-headline-sm text-[22px] text-primary">Feed professionista</h2>
                {loading ? <span className="text-sm text-on-surface-variant">Caricamento…</span> : null}
              </div>

              {feedPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
                  Nessun post nel feed. Segui altri professionisti o pubblica il primo post.
                </div>
              ) : (
                <div className="space-y-4">
                  {feedPosts.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-label-md text-primary">
                            {fullName(post.author)}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {formatTime(post.created_at)}
                          </div>
                        </div>
                        {post.author_id === profile.id ? (
                          <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant">
                            Tuo post
                          </span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">
                        {post.body}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-headline-sm text-[22px] text-primary">Messaggi</h2>
                <Link className="text-sm font-bold text-primary hover:underline" href="/messages">
                  Apri
                </Link>
              </div>
              {conversations.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Nessuna conversazione.</p>
              ) : (
                <div className="space-y-3">
                  {conversations.slice(0, 4).map((conversation) => (
                    <Link
                      key={conversation.id}
                      href={`/messages?conversation=${encodeURIComponent(conversation.id)}`}
                      className="block rounded-2xl bg-surface-container-low p-3 transition hover:bg-surface-container"
                    >
                      <div className="font-label-md text-primary">
                        {fullName(conversation.participant)}
                      </div>
                      <div className="line-clamp-1 text-sm text-on-surface-variant">
                        {conversation.last_message_body ?? "Conversazione avviata"}
                      </div>
                      <div className="mt-1 text-xs text-on-surface-variant">
                        {formatTime(conversation.last_message_at ?? conversation.created_at)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <h2 className="mb-4 font-headline-sm text-[22px] text-primary">
                Richieste recenti
              </h2>
              {requests.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Nessuna richiesta ricevuta.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="rounded-2xl bg-surface-container-low p-3">
                      <div className="font-label-md text-primary">{request.subject}</div>
                      <div className="text-sm text-on-surface-variant">
                        {fullName(request.participant)} · {requestStatusLabel(request.status)}
                      </div>
                      {request.conversation_id ? (
                        <Link
                          className="mt-2 inline-flex text-sm font-bold text-primary hover:underline"
                          href={`/messages?conversation=${encodeURIComponent(request.conversation_id)}`}
                        >
                          Vai alla chat
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <h2 className="mb-4 font-headline-sm text-[22px] text-primary">I tuoi post</h2>
              {ownPosts.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Non hai ancora pubblicato post.
                </p>
              ) : (
                <div className="space-y-3">
                  {ownPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="rounded-2xl bg-surface-container-low p-3">
                      <p className="line-clamp-2 text-sm text-on-surface">{post.body}</p>
                      <div className="mt-1 text-xs text-on-surface-variant">
                        {formatTime(post.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section
              id="impostazioni"
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
            >
              <h2 className="mb-2 font-headline-sm text-[22px] text-primary">
                Impostazioni
              </h2>
              <p className="text-sm text-on-surface-variant">
                Gestisci account, profilo pubblico, notifiche e preferenze dalla tua area
                professionista.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  className="rounded-full border-2 border-primary px-5 py-3 text-center font-button text-button text-primary hover:bg-primary hover:text-white"
                  href="/messages"
                >
                  Gestisci messaggi
                </Link>
                <SignOutButton className="rounded-full px-5 py-3 text-center font-button text-button text-error hover:bg-error-container/30">
                  Logout
                </SignOutButton>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
