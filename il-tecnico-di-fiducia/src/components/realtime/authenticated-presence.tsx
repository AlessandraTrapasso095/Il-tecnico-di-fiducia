"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

type AuthenticatedPresenceProps = {
  userId: string;
  role: string;
  activeConversationId?: string | null;
  children?: ReactNode;
};

type PresencePayload = {
  user_id: string;
  role: string;
  active_conversation_id: string | null;
  online_at: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const GLOBAL_PRESENCE_CHANNEL = "presence:authenticated-users";
const EMPTY_ONLINE_USER_IDS = new Set<string>();

type AuthenticatedPresenceContextValue = {
  onlineUserIds: Set<string>;
  presenceReady: boolean;
  isUserOnline: (userId: string | null | undefined) => boolean;
};

const AuthenticatedPresenceContext = createContext<AuthenticatedPresenceContextValue>({
  onlineUserIds: EMPTY_ONLINE_USER_IDS,
  presenceReady: false,
  isUserOnline: () => false,
});

export function useAuthenticatedPresence() {
  return useContext(AuthenticatedPresenceContext);
}

export function AuthenticatedPresence({
  userId,
  role,
  activeConversationId = null,
  children = null,
}: AuthenticatedPresenceProps) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const activeConversationRef = useRef<string | null>(activeConversationId);
  const heartbeatRef = useRef<number | null>(null);
  const subscribedRef = useRef(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [presenceReady, setPresenceReady] = useState(false);

  function payload(): PresencePayload {
    return {
      user_id: userId,
      role,
      active_conversation_id: activeConversationRef.current,
      online_at: new Date().toISOString(),
    };
  }

  function trackPresence() {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    void channel.track(payload());
  }

  function touchActivity() {
    void fetch("/api/activity", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {
      // Best-effort fallback for server-side last_seen checks.
    });
  }

  function syncPresenceState(channel: RealtimeChannel) {
    try {
      const state = channel.presenceState() as Record<string, PresencePayload[]>;
      const nextOnlineUserIds = new Set<string>();

      Object.entries(state).forEach(([key, presences]) => {
        const userPresence = presences.find((presence) => presence.user_id);
        const presentUserId = userPresence?.user_id ?? key;
        if (presentUserId && presences.length > 0) {
          nextOnlineUserIds.add(presentUserId);
        }
      });

      setOnlineUserIds(nextOnlineUserIds);
      setPresenceReady(true);
    } catch (error) {
      console.error("[presence] Failed to sync global presence state", error);
      setPresenceReady(false);
    }
  }

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
    trackPresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    if (!userId || !role) return;

    let channel: RealtimeChannel | null = null;

    try {
      channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          if (channel) syncPresenceState(channel);
        })
        .on("presence", { event: "join" }, () => {
          if (channel) syncPresenceState(channel);
        })
        .on("presence", { event: "leave" }, () => {
          if (channel) syncPresenceState(channel);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            subscribedRef.current = true;
            trackPresence();
            touchActivity();
            if (channel) syncPresenceState(channel);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            subscribedRef.current = false;
            setPresenceReady(false);
          }
        });
    } catch (error) {
      console.error("[presence] Initialization failed", error);
      subscribedRef.current = false;
      return;
    }

    heartbeatRef.current = window.setInterval(() => {
      trackPresence();
      touchActivity();
    }, HEARTBEAT_INTERVAL_MS);

    function handleVisibleAgain() {
      if (document.visibilityState === "visible") {
        trackPresence();
        touchActivity();
      }
    }

    function handlePageExit() {
      if (channel) void channel.untrack();
    }

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibleAgain);

    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      document.removeEventListener("visibilitychange", handleVisibleAgain);
      if (!channel) return;
      void channel.untrack();
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      subscribedRef.current = false;
      setPresenceReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, supabase, userId]);

  const value = useMemo<AuthenticatedPresenceContextValue>(
    () => ({
      onlineUserIds,
      presenceReady,
      isUserOnline: (targetUserId) =>
        Boolean(targetUserId && onlineUserIds.has(targetUserId)),
    }),
    [onlineUserIds, presenceReady],
  );

  return (
    <AuthenticatedPresenceContext.Provider value={value}>
      {children}
    </AuthenticatedPresenceContext.Provider>
  );
}
