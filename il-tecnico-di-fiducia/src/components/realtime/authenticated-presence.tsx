"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { InactivityTimeoutProvider } from "@/components/auth/inactivity-timeout-provider";
import { logRealtimeDev } from "@/lib/realtime-dev-logger";
import { createClient } from "@/lib/supabase/client";

type AuthenticatedPresenceProps = {
  userId: string;
  role: string;
  activeConversationId?: string | null;
  children?: ReactNode;
};

type PresencePayload = {
  user_id: string;
  active_conversation_id: string | null;
  last_seen: string;
};

const HEARTBEAT_INTERVAL_MS = 60_000;
const GLOBAL_PRESENCE_CHANNEL = "authenticated-users";
const EMPTY_ONLINE_USER_IDS = new Set<string>();

type AuthenticatedPresenceContextValue = {
  onlineUserIds: Set<string>;
  presenceReady: boolean;
  isUserOnline: (userId: string | null | undefined) => boolean;
  setActiveConversationId: (conversationId: string | null) => void;
};

const AuthenticatedPresenceContext = createContext<AuthenticatedPresenceContextValue>({
  onlineUserIds: EMPTY_ONLINE_USER_IDS,
  presenceReady: false,
  isUserOnline: () => false,
  setActiveConversationId: () => {},
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

  const payload = useCallback((): PresencePayload => {
    return {
      user_id: userId,
      active_conversation_id: activeConversationRef.current,
      last_seen: new Date().toISOString(),
    };
  }, [userId]);

  const trackPresence = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    logRealtimeDev("presence.track", {
      scope: "presence",
      channelName: GLOBAL_PRESENCE_CHANNEL,
      activeConversationId: activeConversationRef.current,
    });
    void channel.track(payload());
  }, [payload]);

  const touchActivity = useCallback((reason = "manual") => {
    logRealtimeDev("heartbeat.sent", {
      scope: "presence",
      reason,
    });
    void fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    }).catch(() => {
      // Best-effort server projection for non-realtime email decisions.
    });
  }, []);

  const syncPresenceState = useCallback((channel: RealtimeChannel) => {
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
  }, []);

  const setPresenceActiveConversationId = useCallback(
    (conversationId: string | null) => {
      const nextConversationId = conversationId?.trim() || null;
      if (activeConversationRef.current === nextConversationId) return;
      activeConversationRef.current = nextConversationId;
      trackPresence();
    },
    [trackPresence],
  );

  useEffect(() => {
    setPresenceActiveConversationId(activeConversationId);
  }, [activeConversationId, setPresenceActiveConversationId]);

  useEffect(() => {
    if (!userId || !role) return;

    let channel: RealtimeChannel | null = null;

    try {
      logRealtimeDev("channel.created", {
        scope: "presence",
        channelName: GLOBAL_PRESENCE_CHANNEL,
      });
      channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          logRealtimeDev("presence.event", {
            scope: "presence",
            eventType: "sync",
            channelName: GLOBAL_PRESENCE_CHANNEL,
          });
          if (channel) syncPresenceState(channel);
        })
        .on("presence", { event: "join" }, () => {
          logRealtimeDev("presence.event", {
            scope: "presence",
            eventType: "join",
            channelName: GLOBAL_PRESENCE_CHANNEL,
          });
          if (channel) syncPresenceState(channel);
        })
        .on("presence", { event: "leave" }, () => {
          logRealtimeDev("presence.event", {
            scope: "presence",
            eventType: "leave",
            channelName: GLOBAL_PRESENCE_CHANNEL,
          });
          if (channel) syncPresenceState(channel);
        })
        .subscribe((status) => {
          logRealtimeDev("subscription.presence", {
            scope: "presence",
            status,
            channelName: GLOBAL_PRESENCE_CHANNEL,
          });
          if (status === "SUBSCRIBED") {
            subscribedRef.current = true;
            trackPresence();
            touchActivity("subscribed");
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
      touchActivity("interval");
    }, HEARTBEAT_INTERVAL_MS);

    function handleVisibleAgain() {
      if (document.visibilityState === "visible") {
        trackPresence();
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
      logRealtimeDev("channel.removed", {
        scope: "presence",
        channelName: GLOBAL_PRESENCE_CHANNEL,
      });
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      subscribedRef.current = false;
      setPresenceReady(false);
    };
  }, [role, supabase, syncPresenceState, touchActivity, trackPresence, userId]);

  const value = useMemo<AuthenticatedPresenceContextValue>(
    () => ({
      onlineUserIds,
      presenceReady,
      isUserOnline: (targetUserId) =>
        Boolean(targetUserId && onlineUserIds.has(targetUserId)),
      setActiveConversationId: setPresenceActiveConversationId,
    }),
    [onlineUserIds, presenceReady, setPresenceActiveConversationId],
  );

  return (
    <AuthenticatedPresenceContext.Provider value={value}>
      <InactivityTimeoutProvider role={role as "customer" | "professional" | "admin"}>
        {children}
      </InactivityTimeoutProvider>
    </AuthenticatedPresenceContext.Provider>
  );
}
