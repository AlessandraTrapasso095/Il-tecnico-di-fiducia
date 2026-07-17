"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeaderBackButton } from "@/components/navigation/header-back-button";
import { AuthenticatedPresence } from "@/components/realtime/authenticated-presence";
import { Footer } from "@/components/site/footer";
import { fetchJson } from "@/lib/api/fetch-json";
import { createClient } from "@/lib/supabase/client";
import type { ConversationRow, MeResponse } from "@/lib/types/chat";
import {
  mergeProfessionCategories,
  professionCategoryKey,
  type DbProfessionCategory,
  type ProfessionCategory,
} from "@/lib/professions/taxonomy";

import MessagesClient from "../messages/messages-client";

type CustomerProfileLite = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
};

type ProfessionalRow = {
  id: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  headline: string | null;
  specializations: string[] | null;
  avatar_url: string | null;
  available_remote: boolean | null;
  available_travel: boolean | null;
  rating_average: number | null;
  reviews_count: number;
};

type ProfessionalsResponse = {
  page: number;
  page_size: number;
  total: number;
  professionals: ProfessionalRow[];
};

type Province = { code: string; name: string };

type ProvincesResponse = { provinces: Province[] };
type CategoriesResponse = { categories: DbProfessionCategory[] };

type ContactRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "concluded"
  | "closed"
  | "completed";

type ContactRequestRow = {
  id: string;
  professional_id: string;
  subject: string;
  status: ContactRequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
  professional_available?: boolean | null;
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    province_code: string | null;
    avatar_url: string | null;
    headline: string | null;
  } | null;
};

type ContactRequestsResponse = {
  page: number;
  page_size: number;
  total: number;
  requests: ContactRequestRow[];
};

type SavedProfessionalsResponse = { professionals: ProfessionalRow[] };

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

type NotificationRealtimeRow = Omit<NotificationRow, "actor" | "entity" | "href"> & {
  recipient_id?: string;
};

type InitialMessages = {
  me: MeResponse;
  conversations: ConversationRow[];
  conversationsError: string | null;
  activeConversationId: string | null;
  initialView: "explore" | "messages";
};

type CustomerDashboardClientProps = {
  profile: CustomerProfileLite;
  initialFilters?: {
    q?: string;
    provinceCode?: string;
    categoryId?: string;
    remote?: boolean;
    travel?: boolean;
  };
  initialMessages: InitialMessages;
};

type ContactModalState = {
  open: boolean;
  professional: ProfessionalRow | null;
};

function fullName(p: { first_name: string; last_name: string } | null | undefined) {
  if (!p) return "Professionista";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Professionista";
}

function initials(firstName: string, lastName: string) {
  const a = (firstName ?? "").trim().slice(0, 1).toUpperCase();
  const b = (lastName ?? "").trim().slice(0, 1).toUpperCase();
  return `${a}${b}` || "U";
}

function statusLabel(status: ContactRequestStatus) {
  switch (status) {
    case "pending":
      return "In attesa";
    case "accepted":
      return "Aperta";
    case "rejected":
      return "Rifiutata";
    case "concluded":
    case "closed":
    case "completed":
      return "Conclusa";
    default:
      return status;
  }
}

function statusBadgeClass(status: ContactRequestStatus) {
  switch (status) {
    case "pending":
      return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
    case "accepted":
      return "bg-primary-fixed text-on-primary-fixed-variant";
    case "rejected":
      return "bg-error-container text-on-error-container";
    case "concluded":
    case "closed":
    case "completed":
      return "bg-surface-container-high text-on-surface-variant";
    default:
      return "bg-surface-container-highest text-on-surface-variant";
  }
}

function sanitizeQuery(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 64);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatNotificationTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function notificationText(notification: NotificationRow) {
  const actor = fullName(notification.actor);

  if (notification.type === "contact_request_accepted") {
    return `${actor} ha accettato la tua richiesta`;
  }

  if (notification.type === "contact_request_rejected") {
    return `${actor} ha rifiutato la tua richiesta`;
  }

  if (notification.type === "message_received") {
    return `Hai ricevuto un nuovo messaggio da ${actor}`;
  }

  if (notification.type === "quote_sent") {
    return `${actor} ti ha inviato un preventivo`;
  }

  if (notification.type === "support_ticket_replied") {
    return notification.entity?.subject
      ? `Hai ricevuto una risposta al ticket: ${notification.entity.subject}`
      : "Hai ricevuto una risposta al tuo ticket";
  }

  if (notification.type === "support_ticket_resolved") {
    return notification.entity?.subject
      ? `Il ticket ${notification.entity.subject} è stato segnato come risolto`
      : "Il tuo ticket è stato segnato come risolto";
  }

  return "Nuova notifica";
}

function categoryOptionValue(category: ProfessionCategory) {
  return category.id !== null && category.id !== undefined
    ? `id:${category.id}`
    : professionCategoryKey(category);
}

function splitCategoryId(value: string) {
  return value.startsWith("id:") ? value.slice(3) : "";
}

function RatingStars({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  const rounded = count > 0 && average !== null ? Math.round(average) : 0;
  return (
    <div className="flex items-center gap-2 text-sm" aria-label={`${count} recensioni`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={[
              "material-symbols-outlined text-[18px]",
              index < rounded ? "text-[#FF8500]" : "text-outline-variant",
            ].join(" ")}
            aria-hidden
            style={{
              fontVariationSettings: index < rounded ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            star
          </span>
        ))}
      </div>
      <span className="font-label-md text-label-md text-on-surface-variant">
        {count > 0 ? `(${count})` : "0 recensioni"}
      </span>
    </div>
  );
}

function customerNotificationFallbackHref(notification: NotificationRealtimeRow) {
  if (notification.entity_type === "conversation" && notification.entity_id) {
    return `/customer?section=messages&conversation=${notification.entity_id}`;
  }

  if (notification.entity_type === "contact_request") {
    return "/customer?section=messages";
  }

  return "/customer";
}

export default function CustomerDashboardClient({
  profile,
  initialFilters,
  initialMessages,
}: CustomerDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<"explore" | "messages">(initialMessages.initialView);
  const [messagesKey, setMessagesKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialMessages.activeConversationId,
  );

  const [q, setQ] = useState(() => initialFilters?.q ?? "");
  const [provinceCode, setProvinceCode] = useState<string>(
    () => initialFilters?.provinceCode ?? "",
  );
  const [categoryKey, setCategoryKey] = useState<string>(() =>
    initialFilters?.categoryId ? `id:${initialFilters.categoryId}` : "",
  );
  const [subcategorySlug, setSubcategorySlug] = useState("");
  const [remote, setRemote] = useState(() => initialFilters?.remote ?? false);
  const [travel, setTravel] = useState(() => initialFilters?.travel ?? false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ProfessionCategory[]>(() =>
    mergeProfessionCategories([]),
  );

  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [professionalsTotal, setProfessionalsTotal] = useState(0);
  const [professionalsLoading, setProfessionalsLoading] = useState(false);
  const [professionalsError, setProfessionalsError] = useState<string | null>(null);

  const [requests, setRequests] = useState<ContactRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedProfessionals, setSavedProfessionals] = useState<ProfessionalRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const [contactModal, setContactModal] = useState<ContactModalState>({
    open: false,
    professional: null,
  });
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactPrivacy, setContactPrivacy] = useState(false);
  const [contactFiles, setContactFiles] = useState<File[]>([]);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactDone, setContactDone] = useState<{ conversationId: string | null } | null>(
    null,
  );

  const searchDebounce = useRef<number | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const favoritesRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const provinceNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    provinces.forEach((p) => m.set(p.code, p.name));
    return m;
  }, [provinces]);

  const currentCategory = useMemo(
    () =>
      categories.find((category) => categoryOptionValue(category) === categoryKey) ?? null,
    [categories, categoryKey],
  );
  const currentSubcategories = currentCategory?.subcategories ?? [];
  const currentSubcategory =
    currentSubcategories.find((subcategory) => subcategory.slug === subcategorySlug) ?? null;
  const hasActiveSearch =
    Boolean(sanitizeQuery(q)) ||
    Boolean(provinceCode) ||
    Boolean(categoryKey) ||
    Boolean(subcategorySlug) ||
    remote ||
    travel;
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );
  const currentRelativeUrl = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  async function loadFilters() {
    try {
      const [prov, cat] = await Promise.all([
        fetchJson<ProvincesResponse>("/api/provinces", { method: "GET" }),
        fetchJson<CategoriesResponse>("/api/categories", { method: "GET" }),
      ]);
      setProvinces(prov.provinces ?? []);
      setCategories(mergeProfessionCategories(cat.categories ?? []));
    } catch {
      setCategories(mergeProfessionCategories([]));
    }
  }

  async function loadSaved() {
    setSavedLoading(true);
    try {
      const res = await fetchJson<SavedProfessionalsResponse>("/api/saved-professionals", {
        method: "GET",
      });
      const nextProfessionals = res.professionals ?? [];
      setSavedProfessionals(nextProfessionals);
      setSavedIds(new Set(nextProfessionals.map((p) => p.id)));
    } catch {
      // Non blocca la ricerca: i preferiti sono decorativi.
    } finally {
      setSavedLoading(false);
    }
  }

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetchJson<NotificationsResponse>("/api/notifications?limit=10", {
        method: "GET",
      });
      setNotifications(res.notifications ?? []);
    } catch {
      // Realtime inserts/updates must keep the badge coherent even if hydration fails.
    }
  }, []);

  async function loadRequests() {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await fetchJson<ContactRequestsResponse>(
        "/api/contact-requests?page_size=8&page=1",
        { method: "GET" },
      );
      setRequests(res.requests ?? []);
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Errore imprevisto.");
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadProfessionals(next?: { page: number }) {
    const page = next?.page ?? 1;
    setProfessionalsLoading(true);
    setProfessionalsError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", "12");

    const qq = sanitizeQuery(q);
    const categoryId = currentCategory
      ? splitCategoryId(categoryOptionValue(currentCategory))
      : "";
    if (qq) params.set("q", qq);
    if (provinceCode) params.set("province_code", provinceCode);
    if (categoryId) params.set("category_id", categoryId);
    if (currentCategory && !categoryId) params.set("category_slug", currentCategory.slug);
    if (currentSubcategory) params.set("subcategory", currentSubcategory.name);
    if (remote) params.set("remote", "true");
    if (travel) params.set("travel", "true");
    if (!hasActiveSearch) {
      params.set("recommended", "true");
      if (profile.province_code) {
        params.set("customer_province_code", profile.province_code);
      }
    }

    try {
      const res = await fetchJson<ProfessionalsResponse>(`/api/professionals?${params}`, {
        method: "GET",
      });
      setProfessionals(res.professionals ?? []);
      setProfessionalsTotal(res.total ?? 0);
    } catch (e) {
      setProfessionalsError(e instanceof Error ? e.message : "Errore imprevisto.");
      setProfessionals([]);
      setProfessionalsTotal(0);
    } finally {
      setProfessionalsLoading(false);
    }
  }

  function openMessages(conversationId?: string | null) {
    const nextConversationId = conversationId ?? null;
    const shouldReloadMessages =
      view !== "messages" || activeConversationId !== nextConversationId;

    setActiveConversationId(nextConversationId);
    if (shouldReloadMessages) {
      setMessagesKey((value) => value + 1);
    }
    setView("messages");
    window.requestAnimationFrame(() => {
      document
        .getElementById("messaggi-cliente")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToRequests() {
    setView("explore");
    window.requestAnimationFrame(() => {
      document
        .getElementById("richieste")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateCategory(nextKey: string) {
    setCategoryKey(nextKey);
    setSubcategorySlug("");
  }

  function resetFilters() {
    setQ("");
    setProvinceCode("");
    setCategoryKey("");
    setSubcategorySlug("");
    setRemote(false);
    setTravel(false);
  }

  const mergeRealtimeNotification = useCallback((row: NotificationRealtimeRow | null | undefined) => {
    if (!row?.id) return;

    setNotifications((current) => {
      const nextNotification: NotificationRow = {
        ...row,
        href: customerNotificationFallbackHref(row),
        actor: null,
        entity: null,
      };
      const index = current.findIndex((notification) => notification.id === row.id);

      if (index === -1) {
        return [nextNotification, ...current].slice(0, 10);
      }

      const next = [...current];
      next[index] = {
        ...next[index],
        ...row,
      };
      return next;
    });
  }, []);

  function handleCustomerNotificationClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    notification: NotificationRow,
  ) {
    setNotificationsOpen(false);
    void markNotificationRead(notification.id);

    if (typeof window === "undefined") return;

    const target = new URL(notification.href, window.location.origin);
    const targetRelativeUrl = `${target.pathname}${target.search}`;
    const isCustomerTarget = target.pathname === "/customer" || target.pathname === "/cliente";

    if (!isCustomerTarget) {
      if (targetRelativeUrl === currentRelativeUrl) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();

    const section = target.searchParams.get("section");
    const conversationId = target.searchParams.get("conversation");

    if (targetRelativeUrl !== currentRelativeUrl) {
      router.push(targetRelativeUrl, { scroll: false });
    }

    if (section === "messages") {
      openMessages(conversationId);
      return;
    }

    setView("explore");
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadFilters();
      void loadSaved();
      void loadRequests();
      void loadNotifications();
      void loadProfessionals();
    }, 0);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile.id) return;

    const channel = supabase
      .channel(`db:notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            mergeRealtimeNotification(payload.new as NotificationRealtimeRow);
          }
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<NotificationRealtimeRow>;
            setNotifications((current) =>
              current.filter((notification) => notification.id !== deleted.id),
            );
          }
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, mergeRealtimeNotification, profile.id, supabase]);

  useEffect(() => {
    if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(() => {
      void loadProfessionals();
    }, 300);
    return () => {
      if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, provinceCode, categoryKey, subcategorySlug, remote, travel, categories.length]);

  useEffect(() => {
    if (!filterOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (filterRef.current?.contains(target)) return;
      setFilterOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filterOpen]);

  useEffect(() => {
    if (!favoritesOpen && !notificationsOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (favoritesOpen && !favoritesRef.current?.contains(target)) {
        setFavoritesOpen(false);
      }
      if (notificationsOpen && !notificationsRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [favoritesOpen, notificationsOpen]);

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

  async function markNotificationsRead() {
    const ids = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);
    if (ids.length === 0) return;

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
      ),
    );

    try {
      await fetchJson<{ ok: true }>("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      });
    } catch {
      void loadNotifications();
    }
  }

  async function toggleSaved(professional: ProfessionalRow) {
    const professionalId = professional.id;
    const isSaved = savedIds.has(professionalId);
    const previousSavedIds = savedIds;
    const previousProfessionals = savedProfessionals;

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(professionalId);
      else next.add(professionalId);
      return next;
    });
    setSavedProfessionals((prev) =>
      isSaved
        ? prev.filter((item) => item.id !== professionalId)
        : [professional, ...prev.filter((item) => item.id !== professionalId)],
    );

    try {
      if (isSaved) {
        await fetchJson<{ ok: true }>(`/api/saved-professionals/${professionalId}`, {
          method: "DELETE",
        });
      } else {
        await fetchJson<{ ok: true }>("/api/saved-professionals", {
          method: "POST",
          body: JSON.stringify({ professional_id: professionalId }),
        });
      }
    } catch {
      setSavedIds(previousSavedIds);
      setSavedProfessionals(previousProfessionals);
    }
  }

  function openContact(pro: ProfessionalRow) {
    setContactModal({ open: true, professional: pro });
    setContactSubject("");
    setContactMessage("");
    setContactPrivacy(false);
    setContactFiles([]);
    setContactError(null);
    setContactDone(null);
  }

  async function sendContactRequest() {
    const pro = contactModal.professional;
    if (!pro) return;

    setContactSending(true);
    setContactError(null);
    try {
      const created = await fetchJson<{ request: { id: string }; conversation_id: string | null }>(
        "/api/contact-requests",
        {
          method: "POST",
          body: JSON.stringify({
            professional_id: pro.id,
            subject: contactSubject,
            message: contactMessage,
            privacy_accepted: contactPrivacy,
          }),
        },
      );

      if (contactFiles.length > 0) {
        const fd = new FormData();
        contactFiles.forEach((f) => fd.append("files", f));
        const res = await fetch(`/api/contact-requests/${created.request.id}/attachments`, {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
      }

      setContactDone({ conversationId: created.conversation_id });
      void loadRequests();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setContactSending(false);
    }
  }

  const heroBg =
    "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1800&h=900&fit=crop";

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <AuthenticatedPresence
        userId={profile.id}
        role="customer"
        activeConversationId={view === "messages" ? activeConversationId : null}
      >
      <header className="fixed top-0 z-50 h-[92px] w-full bg-surface-container-lowest/88 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderBackButton
              fallbackHref="/customer"
              hiddenPathnames={["/customer", "/cliente"]}
              forceVisible={view !== "explore"}
              onBack={() => setView("explore")}
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
            <button
              type="button"
              className="font-label-md text-label-md font-bold text-on-tertiary-container underline decoration-2 underline-offset-8"
              onClick={() => setView("explore")}
            >
              Cerca
            </button>
            <button
              type="button"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-tertiary-container"
              onClick={goToRequests}
            >
              Richieste
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div ref={favoritesRef} className="relative">
              <button
                type="button"
                className="rounded-full p-2 text-primary transition-all hover:bg-surface-container-high"
                title="Preferiti"
                aria-label="Apri preferiti"
                aria-expanded={favoritesOpen}
                onClick={() => {
                  setFavoritesOpen((value) => !value);
                  setFilterOpen(false);
                  setNotificationsOpen(false);
                }}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  favorite
                </span>
              </button>

              {favoritesOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-[95] w-[min(92vw,420px)] overflow-hidden rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest text-left shadow-[0_18px_50px_rgba(8,43,95,0.18)]">
                  <div className="border-b border-outline-variant/25 p-4">
                    <div className="font-headline-sm text-primary">Preferiti</div>
                    <div className="text-sm text-on-surface-variant">
                      I professionisti che hai salvato.
                    </div>
                  </div>

                  {savedProfessionals.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        <span className="material-symbols-outlined" aria-hidden>
                          favorite
                        </span>
                      </div>
                      <div className="font-button text-primary">Nessun preferito</div>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Salva i professionisti cliccando il cuore nelle card.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {savedProfessionals.map((professional) => (
                        <Link
                          key={professional.id}
                          href={`/professionisti/${professional.id}`}
                          className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-container-low"
                          onClick={() => setFavoritesOpen(false)}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary-fixed bg-surface-container-high text-primary">
                            {professional.avatar_url ? (
                              <Image
                                src={professional.avatar_url}
                                alt={fullName(professional)}
                                width={48}
                                height={48}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold">
                                {initials(professional.first_name, professional.last_name)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-button text-primary">
                              {fullName(professional)}
                            </div>
                            <div className="truncate text-xs text-on-surface-variant">
                              {professional.headline ?? "Professione non indicata"}
                            </div>
                            <div className="mt-1 truncate text-xs text-on-surface-variant">
                              {professional.province_code
                                ? provinceNameByCode.get(professional.province_code) ??
                                  professional.province_code
                                : "Provincia non indicata"}
                            </div>
                            <div className="mt-2">
                              <RatingStars
                                average={professional.rating_average}
                                count={professional.reviews_count}
                              />
                            </div>
                            <div className="mt-2 text-xs font-bold text-on-tertiary-container">
                              Vedi profilo
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                className="relative rounded-full p-2 text-primary transition-all hover:bg-surface-container-high"
                title="Notifiche"
                aria-label="Apri notifiche"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setFavoritesOpen(false);
                  setFilterOpen(false);
                  void loadNotifications();
                }}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  notifications
                </span>
                {unreadNotifications > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8500] px-1 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-[95] w-[min(92vw,420px)] overflow-hidden rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest text-left shadow-[0_18px_50px_rgba(8,43,95,0.18)]">
                  <div className="flex items-center justify-between gap-3 border-b border-outline-variant/25 p-4">
                    <div>
                      <div className="font-headline-sm text-primary">Notifiche</div>
                      <div className="text-sm text-on-surface-variant">
                        Aggiornamenti su richieste e messaggi.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-bold text-primary hover:underline"
                      onClick={() => void markNotificationsRead()}
                    >
                      Segna lette
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        <span className="material-symbols-outlined" aria-hidden>
                          notifications
                        </span>
                      </div>
                      <div className="font-button text-primary">Nessuna notifica</div>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Qui compariranno aggiornamenti reali su richieste e messaggi.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notifications.map((notification) => {
                        const actor = notification.actor ?? {
                          first_name: "Il Tecnico",
                          last_name: "",
                          avatar_url: null,
                        };
                        const actorInitials = initials(actor.first_name, actor.last_name);
                        return (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-container-low"
                            onClick={(event) =>
                              handleCustomerNotificationClick(event, notification)
                            }
                          >
                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-fixed bg-surface-container-high text-primary">
                              {actor.avatar_url ? (
                                <Image
                                  src={actor.avatar_url}
                                  alt={fullName(actor)}
                                  width={44}
                                  height={44}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <span className="text-xs font-bold">{actorInitials}</span>
                              )}
                              {!notification.read_at ? (
                                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#FF8500]" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-primary">
                                {notificationText(notification)}
                              </div>
                              <div className="mt-1 text-xs text-on-surface-variant">
                                {formatNotificationTime(notification.created_at)}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="rounded-full p-2 text-primary transition-all hover:bg-surface-container-high"
              title="Messaggi"
              onClick={() => openMessages()}
            >
              <span className="material-symbols-outlined" aria-hidden>
                chat
              </span>
            </button>
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

      <main
        className={
          view === "messages"
            ? "flex h-[100dvh] min-h-0 flex-col overflow-hidden pt-[92px]"
            : "pt-[92px]"
        }
      >
        {view === "messages" ? (
          <section id="messaggi-cliente" className="flex min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
            <div className="mx-auto flex h-full min-h-0 flex-1 max-w-[1280px] flex-col overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-headline-sm text-headline-sm text-primary">
                    Messaggi
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    Conversazioni e richieste con i professionisti.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full border-2 border-primary px-5 py-2 font-button text-button text-primary transition-colors hover:bg-primary hover:text-white"
                  onClick={() => setView("explore")}
                >
                  Torna a Cerca
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <MessagesClient
                  key={messagesKey}
                  embedded
                  initialMe={initialMessages.me}
                  initialConversations={initialMessages.conversations}
                  initialConversationsError={initialMessages.conversationsError}
                  initialActiveConversationId={activeConversationId}
                />
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="relative z-20 overflow-visible px-4 py-16 sm:px-6 md:py-20">
              <div className="absolute inset-0 z-0">
                <Image
                  src={heroBg}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/82 via-primary/60 to-primary/24" />
              </div>
              <div className="relative z-10 mx-auto max-w-[1280px] text-center">
                <h1 className="mx-auto mb-8 max-w-[900px] font-display-lg text-[34px] font-bold leading-tight tracking-[-0.02em] text-white drop-shadow md:text-[48px]">
                  Ciao {profile.first_name}, di cosa hai bisogno oggi?
                </h1>

                <div className="mx-auto max-w-4xl">
                  <div
                    ref={filterRef}
                    className="relative z-[60] rounded-[28px] bg-white/82 p-2 shadow-[0_14px_42px_rgba(8,43,95,0.18)] backdrop-blur-md sm:rounded-full"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <div className="flex min-h-[58px] flex-1 items-center gap-3 px-4">
                        <span className="material-symbols-outlined text-outline" aria-hidden>
                          search
                        </span>
                        <input
                          className="min-w-0 flex-1 border-none bg-transparent font-body-md text-body-md outline-none placeholder:text-outline focus:ring-0"
                          placeholder="Elettricista, Idraulico, Architetto…"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="min-h-[58px] rounded-full border border-outline-variant/30 px-5 text-primary transition-colors hover:bg-surface-container-high"
                        onClick={() => {
                          setFilterOpen((value) => !value);
                          setFavoritesOpen(false);
                        }}
                        aria-label="Apri filtri"
                        aria-expanded={filterOpen}
                      >
                        <span className="material-symbols-outlined" aria-hidden>
                          filter_alt
                        </span>
                      </button>
                      <button
                        type="button"
                        className="min-h-[58px] rounded-full bg-[#FF8500] px-9 font-button text-button text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-[#FF9A2B] active:scale-[0.99]"
                        onClick={() => void loadProfessionals()}
                      >
                        Cerca
                      </button>
                    </div>

                    {filterOpen ? (
                      <div className="fixed inset-x-4 bottom-4 z-[90] max-h-[78vh] overflow-y-auto rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 text-left shadow-[0_18px_50px_rgba(8,43,95,0.18)] sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-[520px] sm:max-h-[calc(100vh-180px)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-headline-sm text-primary">
                              Filtri ricerca
                            </div>
                            <div className="text-sm text-on-surface-variant">
                              Affina categoria, zona e disponibilità.
                            </div>
                          </div>
                          <button
                            type="button"
                            className="rounded-full p-2 text-primary hover:bg-surface-container-low"
                            onClick={() => setFilterOpen(false)}
                            aria-label="Chiudi filtri"
                          >
                            <span className="material-symbols-outlined" aria-hidden>
                              close
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <label className="space-y-2">
                            <span className="font-label-md text-label-md text-on-surface-variant">
                              Categoria
                            </span>
                            <select
                              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                              value={categoryKey}
                              onChange={(e) => updateCategory(e.target.value)}
                            >
                              <option value="">Tutte le categorie</option>
                              {categories.map((category) => (
                                <option
                                  key={categoryOptionValue(category)}
                                  value={categoryOptionValue(category)}
                                >
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="font-label-md text-label-md text-on-surface-variant">
                              Sottocategoria
                            </span>
                            <select
                              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-surface-container-low disabled:text-outline"
                              value={subcategorySlug}
                              onChange={(e) => setSubcategorySlug(e.target.value)}
                              disabled={!currentCategory}
                            >
                              <option value="">
                                {currentCategory
                                  ? "Tutte le sottocategorie"
                                  : "Seleziona prima una categoria"}
                              </option>
                              {currentSubcategories.map((subcategory) => (
                                <option key={subcategory.slug} value={subcategory.slug}>
                                  {subcategory.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2 sm:col-span-2">
                            <span className="font-label-md text-label-md text-on-surface-variant">
                              Provincia
                            </span>
                            <select
                              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                              value={provinceCode}
                              onChange={(e) => setProvinceCode(e.target.value)}
                            >
                              <option value="">Tutte le province</option>
                              {provinces.map((province) => (
                                <option key={province.code} value={province.code}>
                                  {province.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                              checked={remote}
                              onChange={(e) => setRemote(e.target.checked)}
                            />
                            <span className="text-sm text-on-surface-variant">
                              Disponibile da remoto
                            </span>
                          </label>

                          <label className="flex items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                              checked={travel}
                              onChange={(e) => setTravel(e.target.checked)}
                            />
                            <span className="text-sm text-on-surface-variant">
                              Disponibile a trasferte
                            </span>
                          </label>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            className="flex-1 rounded-full border-2 border-primary py-3 font-button text-button text-primary transition-colors hover:bg-primary/5"
                            onClick={resetFilters}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-full bg-[#FF8500] py-3 font-button text-button text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-[#FF9A2B]"
                            onClick={() => {
                              setFilterOpen(false);
                              void loadProfessionals();
                            }}
                          >
                            Aggiorna ricerca
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section id="esplora" className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="font-headline-md text-headline-md text-primary">
                    {hasActiveSearch
                      ? "Professionisti trovati"
                      : "Professionisti consigliati nella tua zona"}
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    {professionalsLoading
                      ? "Caricamento…"
                      : `${professionalsTotal} professionisti disponibili`}
                  </div>
                </div>
              </div>

              {professionalsError ? (
                <div className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                  {professionalsError}
                </div>
              ) : null}

              {professionalsLoading ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-[22px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm"
                    >
                      <div className="mb-3 h-4 w-2/3 rounded bg-surface-container-high" />
                      <div className="mb-6 h-3 w-1/2 rounded bg-surface-container-high" />
                      <div className="h-10 w-full rounded-full bg-surface-container-high" />
                    </div>
                  ))}
                </div>
              ) : professionals.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined" aria-hidden>
                      search_off
                    </span>
                  </div>
                  <div className="font-headline-sm text-headline-sm text-primary">
                    Nessun professionista disponibile
                  </div>
                  <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">
                    Prova a modificare testo, categoria, provincia o disponibilità.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {professionals.map((p) => {
                    const isSaved = savedIds.has(p.id);
                    return (
                      <article
                        key={p.id}
                        className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary-fixed bg-surface-container-high text-primary">
                            {p.avatar_url ? (
                              <Image
                                className="h-full w-full object-cover"
                                alt={fullName(p)}
                                src={p.avatar_url}
                                width={64}
                                height={64}
                              />
                            ) : (
                              <span className="font-button">
                                {initials(p.first_name, p.last_name)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-headline-sm text-[24px] leading-tight text-primary">
                              {fullName(p)}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                              {p.headline ?? "Professione non indicata"}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {p.province_code ? (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-primary">
                                  {provinceNameByCode.get(p.province_code) ?? p.province_code}
                                </span>
                              ) : null}
                              {p.available_remote ? (
                                <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed">
                                  Remoto
                                </span>
                              ) : null}
                              {p.available_travel ? (
                                <span className="rounded-full bg-secondary-fixed px-3 py-1 text-xs font-bold text-on-secondary-fixed">
                                  Trasferte
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-3">
                            <button
                              type="button"
                              className={[
                                "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                                isSaved
                                  ? "border-on-tertiary-container bg-on-tertiary-container/10 text-on-tertiary-container"
                                  : "border-outline-variant/50 text-primary hover:bg-surface-container-high",
                              ].join(" ")}
                              title={isSaved ? "Rimuovi dai salvati" : "Salva professionista"}
                              disabled={savedLoading}
                              onClick={() => void toggleSaved(p)}
                            >
                              <span
                                className="material-symbols-outlined"
                                aria-hidden
                                style={{
                                  fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0",
                                }}
                              >
                                {isSaved ? "favorite" : "favorite_border"}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <RatingStars average={p.rating_average} count={p.reviews_count} />
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            className="flex-1 rounded-full bg-[#FF8500] py-3 font-button text-button text-white transition-colors hover:bg-[#FF9A2B] active:scale-[0.99]"
                            onClick={() => openContact(p)}
                          >
                            Contatta
                          </button>
                          <Link
                            href={`/professionisti/${p.id}`}
                            className="flex-1 rounded-full border-2 border-primary py-3 text-center font-button text-button text-primary transition-colors hover:bg-primary hover:text-white"
                          >
                            Vedi profilo
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section id="richieste" className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="font-headline-md text-headline-md text-primary">
                    Richieste recenti
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    In attesa, aperte o concluse: clicca una richiesta per aprire i messaggi.
                  </div>
                </div>
              </div>

              {requestsError ? (
                <div className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                  {requestsError}
                </div>
              ) : null}

              {requestsLoading ? (
                <div className="animate-pulse rounded-[20px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
                  <div className="mb-3 h-4 w-1/3 rounded bg-surface-container-high" />
                  <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                </div>
              ) : requests.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined" aria-hidden>
                      assignment
                    </span>
                  </div>
                  <div className="font-headline-sm text-headline-sm text-primary">
                    Ancora nessuna richiesta
                  </div>
                  <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">
                    Quando contatterai un professionista, la richiesta comparirà qui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {requests.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="rounded-[22px] border border-outline-variant/30 bg-surface-container-lowest p-5 text-left shadow-[0_4px_20px_rgba(8,43,95,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(8,43,95,0.12)]"
                      onClick={() => openMessages(r.conversation_id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-button text-primary">
                            {fullName(r.participant)}
                          </div>
                          <div className="mt-1 truncate text-sm text-on-surface-variant">
                            {r.subject}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                                statusBadgeClass(r.status),
                              ].join(" ")}
                            >
                              {statusLabel(r.status)}
                            </span>
                            <span className="text-xs text-outline">
                              {formatDate(r.updated_at ?? r.created_at)}
                            </span>
                            {r.professional_available === false ? (
                              <span className="inline-flex items-center rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                                Chat non disponibile
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-primary" aria-hidden>
                          chevron_right
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />

      {contactModal.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setContactModal({ open: false, professional: null })}
          />
          <div className="relative w-full max-w-[640px] overflow-hidden rounded-[24px] border border-white/20 bg-surface-container-lowest shadow-[0_12px_50px_rgba(0,0,0,0.20)]">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 bg-surface-container-lowest/90 p-5 backdrop-blur-md sm:p-6">
              <div className="min-w-0">
                <div className="mb-1 font-headline-sm text-primary">
                  {contactDone
                    ? "Richiesta inviata"
                    : `Invia una richiesta a ${fullName(contactModal.professional)}`}
                </div>
                <div className="text-sm text-on-surface-variant">
                  {contactDone
                    ? "Appena il professionista accetterà o rifiuterà la tua richiesta, riceverai una notifica di avviso."
                    : "Compila il modulo per aprire una conversazione in attesa."}
                </div>
              </div>
              <button
                type="button"
                className="h-10 w-10 rounded-full transition-colors hover:bg-surface-container-high"
                onClick={() => setContactModal({ open: false, professional: null })}
                aria-label="Chiudi"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {contactDone ? (
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined" aria-hidden>
                      mark_email_read
                    </span>
                  </div>
                  <div className="mb-1 font-button text-primary">Richiesta inviata</div>
                  <div className="text-sm text-on-surface-variant">
                    Appena il professionista accetterà o rifiuterà la tua richiesta,
                    riceverai una notifica di avviso.
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="w-full rounded-full bg-primary py-3 font-button text-button text-white transition-colors hover:bg-secondary sm:w-auto sm:px-8"
                      onClick={() => setContactModal({ open: false, professional: null })}
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Oggetto
                    </label>
                    <input
                      className="w-full rounded-[12px] border border-outline-variant px-4 py-3 font-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Es. Rifacimento impianto elettrico"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Messaggio
                    </label>
                    <textarea
                      className="w-full resize-none rounded-[12px] border border-outline-variant px-4 py-3 font-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Descrivi brevemente la tua necessità…"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Allegati (immagini, video o PDF · max 10)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
                      onChange={(e) => setContactFiles(Array.from(e.target.files ?? []))}
                    />
                    {contactFiles.length > 0 ? (
                      <div className="text-xs text-on-surface-variant">
                        {contactFiles.length} file selezionati
                      </div>
                    ) : null}
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
                      checked={contactPrivacy}
                      onChange={(e) => setContactPrivacy(e.target.checked)}
                      required
                    />
                    <span className="text-sm leading-relaxed text-on-surface-variant">
                      Dichiaro di aver letto l’informativa privacy e acconsento al trattamento
                      dei dati per la gestione della richiesta.
                    </span>
                  </label>

                  {contactError ? (
                    <div className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                      {contactError}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <button
                      type="button"
                      className="flex-1 rounded-full border-2 border-primary py-3 font-button text-button text-primary transition-colors hover:bg-primary/5"
                      onClick={() => setContactModal({ open: false, professional: null })}
                      disabled={contactSending}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-full bg-on-tertiary-container py-3 font-button text-button text-white shadow-lg shadow-on-tertiary-container/20 transition-colors hover:bg-[#FF9A2B] disabled:opacity-60"
                      onClick={() => void sendContactRequest()}
                      disabled={contactSending}
                    >
                      {contactSending ? "Invio…" : "Invia richiesta"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      </AuthenticatedPresence>
    </div>
  );
}
