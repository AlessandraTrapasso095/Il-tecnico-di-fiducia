"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import type { RealtimePostgresChangesPayload } from "@supabase/realtime-js";

import { fetchJson } from "@/lib/api/fetch-json";
import type {
  ConversationDetailResponse,
  ConversationRow,
  MeResponse,
  MessageRow,
  MessagesResponse,
  Participant,
  RequestStatus,
} from "@/lib/types/chat";
import { createClient } from "@/lib/supabase/client";

type MessagesClientProps = {
  initialMe: MeResponse | null;
  initialMeError?: string | null;
  initialConversations: ConversationRow[];
  initialConversationsError?: string | null;
  initialActiveConversationId?: string | null;
  embedded?: boolean;
};

type ContactRequestSummary = {
  id: string;
  subject: string;
  status: RequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type RequestAttachment = {
  path: string;
  signed_url: string;
  expires_at: string;
};

type AttachmentsResponse = {
  attachments: RequestAttachment[];
};

type PresencePayload = {
  user_id: string;
  online_at: string;
};

type TypingPayload = {
  user_id: string;
  is_typing: boolean;
};

function fullName(p: Participant | null | undefined) {
  if (!p) return "Utente";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utente";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "In attesa";
    case "accepted":
      return "Accettata";
    case "rejected":
      return "Rifiutata";
    case "concluded":
    case "closed":
    case "completed":
      return "Conclusa";
    default:
      return status ?? "Sconosciuto";
  }
}

function statusBadgeClass(status: string | null | undefined) {
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

function isReadOnlyStatus(status: string | null | undefined) {
  return (
    status === "rejected" ||
    status === "concluded" ||
    status === "closed" ||
    status === "completed"
  );
}

function fileNameFromPath(path: string) {
  return decodeURIComponent(path.split("/").pop() ?? "allegato");
}

function sortConversations(rows: ConversationRow[]) {
  return [...rows].sort((a, b) => {
    const aTs = a.last_message_at ?? a.created_at;
    const bTs = b.last_message_at ?? b.created_at;
    return bTs.localeCompare(aTs);
  });
}

export default function MessagesClient({
  initialMe,
  initialMeError,
  initialConversations,
  initialConversationsError,
  initialActiveConversationId,
  embedded = false,
}: MessagesClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const me = initialMe;
  const meError = initialMeError ?? null;
  const meId = me?.user.id ?? null;
  const role = me?.profile.role ?? null;

  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list");

  const [conversations, setConversations] = useState<ConversationRow[]>(
    () => sortConversations(initialConversations),
  );
  const [conversationsError, setConversationsError] = useState<string | null>(
    initialConversationsError ?? null,
  );
  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetailResponse | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [remoteOnline, setRemoteOnline] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const typingStopTimer = useRef<number | null>(null);
  const hasBroadcastTypingOn = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const convChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const convListChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationsRef = useRef<ConversationRow[]>(conversations);

  const filteredConversations = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = fullName(c.participant).toLowerCase();
    const last = (c.last_message_body ?? "").toLowerCase();
    const subject = (c.request_subject ?? "").toLowerCase();
    return name.includes(q) || last.includes(q) || subject.includes(q);
  });

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function applyConversationPatch(patch: Partial<ConversationRow> & { id: string }) {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === patch.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return sortConversations(next);
    });
  }

  async function hydrateConversation(id: string) {
    if (!id) return;
    try {
      const detail = await fetchJson<ConversationDetailResponse>(`/api/conversations/${id}`, {
        method: "GET",
      });
      setConversations((prev) => {
        if (prev.some((c) => c.id === id)) return prev;
        return sortConversations([
          ...prev,
          {
            ...detail.conversation,
            participant: detail.participant ?? null,
            request_subject: detail.request?.subject ?? null,
          },
        ]);
      });
      setConversationsError(null);
    } catch (e) {
      setConversationsError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function loadConversationDetail(id: string) {
    try {
      const detail = await fetchJson<ConversationDetailResponse>(`/api/conversations/${id}`, {
        method: "GET",
      });
      setActiveDetail(detail);
      setMessagesError(null);

      if (detail.request?.id) {
        try {
          const attachmentData = await fetchJson<AttachmentsResponse>(
            `/api/contact-requests/${detail.request.id}/attachments`,
            { method: "GET" },
          );
          setAttachments(attachmentData.attachments ?? []);
        } catch {
          setAttachments([]);
        }
      } else {
        setAttachments([]);
      }
    } catch (e) {
      setActiveDetail(null);
      setMessages([]);
      setAttachments([]);
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
      return;
    }

    try {
      const data = await fetchJson<MessagesResponse>(`/api/conversations/${id}/messages?limit=200`, {
        method: "GET",
      });
      setMessages(data.messages ?? []);
      queueMicrotask(scrollToBottom);
      setMessagesError(null);
    } catch (e) {
      setMessages([]);
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function acceptOrReject(status: "accepted" | "rejected") {
    const reqId = (activeDetail?.request as ContactRequestSummary | null)?.id ?? null;
    if (!reqId) return;

    setMessagesError(null);
    try {
      const res = await fetchJson<{ request: { id: string; status: RequestStatus } }>(
        `/api/contact-requests/${reqId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      setActiveDetail((prev) =>
        prev?.request
          ? {
              ...prev,
              request: { ...prev.request, status: res.request.status },
            }
          : prev,
      );

      if (activeId) {
        applyConversationPatch({ id: activeId, status: res.request.status });
      }
    } catch (e) {
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function sendMessage() {
    if (!activeId || !draft.trim()) return;
    if (!chatEnabled) return;
    setSendError(null);
    setSending(true);
    try {
      const res = await fetchJson<{ message: MessageRow }>(
        `/api/conversations/${activeId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body: draft }),
        },
      );

      setDraft("");
      hasBroadcastTypingOn.current = false;

      setMessages((prev) => {
        const next = [...prev];
        if (!next.some((m) => m.id === res.message.id)) {
          next.push(res.message);
        }
        return next;
      });

      applyConversationPatch({
        id: activeId,
        last_message_at: res.message.created_at,
        last_message_body: res.message.body,
        last_message_sender_id: res.message.sender_id,
      });

      queueMicrotask(scrollToBottom);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setSending(false);
    }
  }

  async function deleteChat() {
    if (!activeId) return;
    setDeleteError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/conversations/${activeId}`, { method: "DELETE" });

      if (convChannelRef.current) {
        supabase.removeChannel(convChannelRef.current);
        convChannelRef.current = null;
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }

      setConversations((prev) => prev.filter((c) => c.id !== activeId));
      setActiveId(null);
      setActiveDetail(null);
      setMessages([]);
      setMobilePanel("list");
      setConfirmDeleteOpen(false);
      setMenuOpen(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  function stopTypingTimers() {
    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }
    hasBroadcastTypingOn.current = false;
  }

  function sendTyping(isTyping: boolean) {
    const ch = presenceChannelRef.current;
    if (!ch || !meId || !activeId) return;

    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: meId, is_typing: isTyping } satisfies TypingPayload,
    });
  }

  function onDraftChange(next: string) {
    setDraft(next);

    if (!activeId || !meId) return;
    if (!presenceChannelRef.current) return;

    const shouldType = next.trim().length > 0;

    if (!shouldType) {
      stopTypingTimers();
      sendTyping(false);
      return;
    }

    if (!hasBroadcastTypingOn.current) {
      hasBroadcastTypingOn.current = true;
      sendTyping(true);
    }

    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = window.setTimeout(() => {
      hasBroadcastTypingOn.current = false;
      sendTyping(false);
    }, 1500);
  }

  function setupConversationSubscriptions(conversationId: string, otherUserId: string) {
    if (!meId) return;

    if (convChannelRef.current) {
      supabase.removeChannel(convChannelRef.current);
      convChannelRef.current = null;
    }

    const msgChannel = supabase
      .channel(`db:messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          const message = row as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          applyConversationPatch({
            id: conversationId,
            last_message_at: message.created_at,
            last_message_body: message.body,
            last_message_sender_id: message.sender_id,
          });
          queueMicrotask(scrollToBottom);
        },
      )
      .subscribe();

    convChannelRef.current = msgChannel;

    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    stopTypingTimers();
    setRemoteTyping(false);
    setRemoteOnline(false);

    const presenceChannel = supabase
      .channel(`conversation:${conversationId}`, {
        config: { private: true, presence: { key: meId } },
      })
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState() as RealtimePresenceState<PresencePayload>;
        const hasOther = Boolean(state[otherUserId]?.length);
        setRemoteOnline(hasOther);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key === otherUserId) {
          setRemoteOnline(true);
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key === otherUserId) {
          setRemoteOnline(false);
          setRemoteTyping(false);
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as TypingPayload | undefined;
        if (!p || p.user_id !== otherUserId) return;
        setRemoteTyping(Boolean(p.is_typing));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: meId,
            online_at: new Date().toISOString(),
          } satisfies PresencePayload);
        }
      });

    presenceChannelRef.current = presenceChannel;
  }

  function selectConversation(id: string) {
    if (!meId) return;

    setMobilePanel("chat");
    setActiveId(id);
    setActiveDetail(null);
    setMessages([]);
    setAttachments([]);
    setMessagesError(null);
    setSendError(null);
    setDeleteError(null);
    setMenuOpen(false);
    setConfirmDeleteOpen(false);
    setRemoteOnline(false);
    setRemoteTyping(false);
    stopTypingTimers();

    const conv = conversationsRef.current.find((c) => c.id === id) ?? null;
    const otherUserId = conv
      ? conv.customer_id === meId
        ? conv.professional_id
        : conv.customer_id
      : null;

    if (otherUserId) {
      setupConversationSubscriptions(id, otherUserId);
    }

    void loadConversationDetail(id);
  }

  // Optional deep-link: /messages?conversation=<id>
  useEffect(() => {
    if (!initialActiveConversationId) return;
    if (!meId) return;
    if (activeId) return;

    // If the conversation is already in the list, open it. Otherwise try to hydrate it.
    const exists = conversationsRef.current.some((c) => c.id === initialActiveConversationId);
    if (exists) {
      selectConversation(initialActiveConversationId);
      return;
    }

    void hydrateConversation(initialActiveConversationId).then(() => {
      selectConversation(initialActiveConversationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveConversationId, meId]);

  // Keep a stable reference for subscriptions & event handlers.
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Realtime: keep conversation list fresh (status changes + last message preview + new conversations)
  useEffect(() => {
    if (!meId || !role || role === "admin") return;

    if (convListChannelRef.current) {
      supabase.removeChannel(convListChannelRef.current);
      convListChannelRef.current = null;
    }

    const filter =
      role === "customer"
        ? `customer_id=eq.${meId}`
        : `professional_id=eq.${meId}`;

    const channel = supabase
      .channel(`db:conversations:${meId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter },
        (payload: RealtimePostgresChangesPayload<ConversationRow>) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          const conversation = row as ConversationRow;
          applyConversationPatch({
            id: conversation.id,
            status: conversation.status,
            last_message_at: conversation.last_message_at,
            last_message_body: conversation.last_message_body,
            last_message_sender_id: conversation.last_message_sender_id,
            updated_at: conversation.updated_at,
          });

          if (activeId && conversation.id === activeId) {
            setActiveDetail((prev) =>
              prev
                ? {
                    ...prev,
                    conversation: { ...prev.conversation, ...conversation },
                  }
                : prev,
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter },
        (payload: RealtimePostgresChangesPayload<ConversationRow>) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          const conversation = row as ConversationRow;
          void hydrateConversation(conversation.id);
        },
      )
      .subscribe();

    convListChannelRef.current = channel;

    return () => {
      if (convListChannelRef.current) {
        supabase.removeChannel(convListChannelRef.current);
        convListChannelRef.current = null;
      }
    };
  }, [meId, role, activeId, supabase]);

  // Cleanup active chat channels on unmount.
  useEffect(() => {
    return () => {
      stopTypingTimers();
      if (convChannelRef.current) {
        supabase.removeChannel(convChannelRef.current);
        convChannelRef.current = null;
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [supabase]);

  const activeConvListRow = activeId
    ? conversations.find((c) => c.id === activeId) ?? null
    : null;
  const currentRequestStatus =
    activeDetail?.request?.status ??
    activeDetail?.conversation.status ??
    activeConvListRow?.status ??
    null;
  const chatEnabled = currentRequestStatus === "accepted";
  const chatReadOnly = isReadOnlyStatus(currentRequestStatus);

  async function uploadAttachments(files: FileList | null) {
    const requestId = activeDetail?.request?.id ?? null;
    if (!requestId || !files || files.length === 0) return;

    setUploadingAttachment(true);
    setSendError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch(`/api/contact-requests/${requestId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Impossibile caricare gli allegati.");
      }
      const attachmentData = await fetchJson<AttachmentsResponse>(
        `/api/contact-requests/${requestId}/attachments`,
        { method: "GET" },
      );
      setAttachments(attachmentData.attachments ?? []);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setUploadingAttachment(false);
    }
  }

  const showListOnMobile = mobilePanel === "list";
  const showChatOnMobile = mobilePanel === "chat";

  return (
    <main
      className={[
        embedded ? "h-[calc(100vh-80px)]" : "h-screen",
        "flex flex-col overflow-hidden bg-background md:flex-row",
      ].join(" ")}
    >
      <section
        className={[
          showListOnMobile ? "flex" : "hidden",
          "md:flex w-full md:max-w-[360px] md:border-r border-outline-variant bg-surface-container-lowest flex-col flex-1 md:flex-none shrink-0",
        ].join(" ")}
      >
        <div className="p-4 border-b border-outline-variant/30 bg-surface-container-lowest">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-headline-sm text-primary text-[18px] leading-tight">
                Messaggi
              </div>
              <div className="text-[12px] text-on-surface-variant">
                {me?.profile.role === "professional"
                  ? "Account Professionista"
                  : me?.profile.role === "customer"
                    ? "Account Cliente"
                    : ""}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <input
              className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-md transition-all"
              placeholder="Cerca conversazione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          {meError ? (
            <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
              {meError}
            </div>
          ) : null}

          {conversationsError ? (
            <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
              {conversationsError}
            </div>
          ) : null}

          {!me && !meError ? (
            <div className="p-3 text-on-surface-variant">Caricamento…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-3 text-on-surface-variant">Nessuna conversazione.</div>
          ) : (
            filteredConversations.map((c) => {
              const selected = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectConversation(c.id)}
                  className={[
                    "w-full text-left p-3 rounded-2xl border transition-all",
                    selected
                      ? "bg-surface-container-high border-primary-container shadow-sm"
                      : "bg-surface-container-lowest border-outline-variant/30 hover:bg-surface-container",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-label-md text-primary truncate">
                        {fullName(c.participant)}
                      </div>
                      <div className="text-[12px] text-on-surface-variant truncate">
                        {c.last_message_body ?? c.request_subject ?? "Richiesta di contatto"}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-outline">
                      {formatTime(c.last_message_at ?? c.created_at)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                        statusBadgeClass(c.status),
                      ].join(" ")}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section
        className={[
          showChatOnMobile ? "flex" : "hidden",
          "md:flex flex-1 flex-col bg-surface-bright min-h-0",
        ].join(" ")}
      >
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-[448px] text-center">
              <div className="text-headline-sm text-primary mb-2">
                Seleziona una conversazione
              </div>
              <p className="text-on-surface-variant">
                Scegli una chat dalla lista a sinistra per iniziare.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2">
                  <button
                    type="button"
                    className="md:hidden mt-0.5 px-3 py-2 rounded-full border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-primary"
                    onClick={() => setMobilePanel("list")}
                    title="Indietro"
                  >
                    ←
                  </button>
                  <div className="min-w-0">
                    <div className="font-headline-sm text-primary leading-tight truncate">
                      {fullName(activeDetail?.participant ?? activeConvListRow?.participant)}
                    </div>
                    <div className="text-[12px] text-on-surface-variant flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1",
                          remoteOnline ? "text-emerald-600" : "text-outline",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "w-2 h-2 rounded-full",
                            remoteOnline ? "bg-emerald-500" : "bg-outline-variant",
                          ].join(" ")}
                        />
                        {remoteTyping
                          ? "Sta scrivendo…"
                          : remoteOnline
                            ? "Online ora"
                            : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-full border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-primary"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    ⋯
                  </button>

                  {menuOpen ? (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-[0_4px_20px_rgba(8,43,95,0.08)] overflow-hidden z-20"
                      role="menu"
                    >
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-error font-label-md text-[13px]"
                        onClick={() => {
                          setConfirmDeleteOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Cancella chat
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {activeDetail?.request ? (
                <div className="px-4 pb-4">
                  <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold">
                        Stato richiesta
                      </div>
                      <div className="text-primary font-label-md truncate">
                        {activeDetail.request.subject}
                      </div>
                      <div className="text-[12px] text-on-surface-variant">
                        {statusLabel(activeDetail.request.status)} •{" "}
                        {formatDay(activeDetail.request.created_at)}
                      </div>
                    </div>

                    {role === "professional" && activeDetail.request.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-error text-white font-button text-[14px] hover:opacity-90 transition-colors"
                          onClick={() => acceptOrReject("rejected")}
                        >
                          Rifiuta
                        </button>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-[#FF8500] text-white font-button text-[14px] hover:bg-[#FF9A2B] transition-colors shadow-sm"
                          onClick={() => acceptOrReject("accepted")}
                        >
                          Accetta richiesta
                        </button>
                      </div>
                    ) : (
                      <span
                        className={[
                          "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold",
                          statusBadgeClass(activeDetail.request.status),
                        ].join(" ")}
                      >
                        {statusLabel(activeDetail.request.status)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4">
              {messagesError ? (
                <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                  {messagesError}
                </div>
              ) : null}

              {!chatEnabled && activeDetail?.request ? (
                <div className="mx-auto max-w-[640px] rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-sm text-on-surface-variant shadow-sm">
                  {activeDetail.request.status === "pending"
                    ? "La richiesta è in attesa: accettala per abilitare la chat."
                    : chatReadOnly
                      ? "Questa richiesta non è più modificabile: la chat è in sola lettura."
                      : "La chat sarà disponibile quando la richiesta verrà accettata."}
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="mx-auto max-w-[720px] rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Allegati condivisi
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <a
                        key={attachment.path}
                        href={attachment.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary-fixed px-3 py-2 text-sm font-bold text-on-primary-fixed-variant hover:underline"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          attach_file
                        </span>
                        <span className="truncate">{fileNameFromPath(attachment.path)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) => {
                const mine = meId ? m.sender_id === meId : false;
                return (
                  <div
                    key={m.id}
                    className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}
                  >
                    <div className="max-w-[70%]">
                      <div
                        className={[
                          "px-4 py-3 rounded-2xl shadow-sm border",
                          mine
                            ? "bg-primary text-white border-primary/20 rounded-tr-none"
                            : "bg-surface-container-lowest border-outline-variant/30 rounded-tl-none",
                        ].join(" ")}
                      >
                        <p className="text-body-md leading-relaxed whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      </div>
                      <div
                        className={[
                          "mt-1 text-[10px] text-outline",
                          mine ? "text-right" : "text-left",
                        ].join(" ")}
                      >
                        {formatTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-outline-variant/30 bg-surface-container-lowest p-4">
              {sendError ? (
                <div className="mb-3 p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                  {sendError}
                </div>
              ) : null}

              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <label
                  className={[
                    "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-outline-variant/40 text-primary transition-colors",
                    chatEnabled
                      ? "hover:bg-surface-container-low"
                      : "cursor-not-allowed opacity-50",
                  ].join(" ")}
                  title="Allega file"
                >
                  <span className="material-symbols-outlined">attach_file</span>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    disabled={!chatEnabled || uploadingAttachment}
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                    onChange={(event) => {
                      void uploadAttachments(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <textarea
                  className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-md resize-none min-h-[48px] max-h-[140px] transition-all"
                  placeholder={
                    chatEnabled
                      ? "Scrivi un messaggio…"
                      : "Accetta la richiesta per abilitare la chat"
                  }
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  disabled={!chatEnabled}
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim() || !chatEnabled}
                  className={[
                    "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all",
                    sending || !draft.trim() || !chatEnabled
                      ? "bg-outline-variant cursor-not-allowed"
                      : "bg-[#FF8500] hover:bg-[#FF9A2B] active:scale-[0.98]",
                  ].join(" ")}
                  title="Invia"
                >
                  ➤
                </button>
              </form>
            </footer>

            {confirmDeleteOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
                  onClick={() => setConfirmDeleteOpen(false)}
                />
                <div className="relative w-full max-w-[448px] bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_12px_40px_rgba(8,43,95,0.18)] p-6">
                  <div className="font-headline-sm text-primary mb-2">
                    Cancellare la chat?
                  </div>
                  <p className="text-on-surface-variant mb-4">
                    La conversazione verrà rimossa dalla tua lista. L’altra persona potrà
                    continuare a vederla.
                  </p>

                  {deleteError ? (
                    <div className="mb-4 p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                      {deleteError}
                    </div>
                  ) : null}

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full border-2 border-primary text-primary font-button hover:bg-primary-fixed transition-colors"
                      onClick={() => setConfirmDeleteOpen(false)}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full bg-error text-white font-button hover:opacity-90 transition-colors"
                      onClick={() => void deleteChat()}
                    >
                      Cancella
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
