import "server-only";

import { randomUUID } from "node:crypto";

import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

type EmailResultLog = {
  sent?: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

type GlobalPresencePayload = {
  user_id?: string;
  active_conversation_id?: string | null;
  last_seen?: string;
};

type GlobalPresenceSnapshot = {
  checked: boolean;
  online: boolean;
  reason: string;
  ageMs: number | null;
  activeConversationId: string | null;
  presenceCount: number;
  errorMessage: string | null;
};

export type NotificationDeliveryState = {
  recipientId: string;
  recipientType: string;
  online: boolean;
  reason: string;
  emailRequired: boolean;
  signals: {
    presenceSource: string;
    globalPresenceRecent: boolean;
    globalPresenceAgeMs: number | null;
    globalPresenceCount: number;
    activeConversationId: string | null;
    activeConversationPresenceRecent: boolean;
    activeConversationPresenceAgeMs: number | null;
    heartbeatRecent: boolean;
    heartbeatAgeMs: number | null;
  };
};

const ACTIVE_CONVERSATION_PRESENCE_WINDOW_MS = 75 * 1000;
const GLOBAL_REALTIME_PRESENCE_WINDOW_MS = 75 * 1000;
const GLOBAL_HEARTBEAT_ONLINE_WINDOW_MS = 90 * 1000;
const GLOBAL_PRESENCE_CHANNEL = "authenticated-users";
const GLOBAL_PRESENCE_SNAPSHOT_TIMEOUT_MS = 1800;

function ageMs(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Date.now() - timestamp;
}

function isRecent(age: number | null, windowMs: number) {
  return age !== null && age >= 0 && age <= windowMs;
}

function buildState({
  recipientId,
  recipientType,
  online,
  reason,
  presenceSource = "unknown",
  globalPresenceAgeMs = null,
  globalPresenceCount = 0,
  activeConversationId = null,
  activeConversationPresenceAgeMs = null,
  heartbeatAgeMs = null,
}: {
  recipientId: string;
  recipientType: string;
  online: boolean;
  reason: string;
  presenceSource?: string;
  globalPresenceAgeMs?: number | null;
  globalPresenceCount?: number;
  activeConversationId?: string | null;
  activeConversationPresenceAgeMs?: number | null;
  heartbeatAgeMs?: number | null;
}): NotificationDeliveryState {
  return {
    recipientId,
    recipientType,
    online,
    reason,
    emailRequired: !online,
    signals: {
      presenceSource,
      globalPresenceRecent: isRecent(
        globalPresenceAgeMs,
        GLOBAL_REALTIME_PRESENCE_WINDOW_MS,
      ),
      globalPresenceAgeMs,
      globalPresenceCount,
      activeConversationId,
      activeConversationPresenceRecent: isRecent(
        activeConversationPresenceAgeMs,
        ACTIVE_CONVERSATION_PRESENCE_WINDOW_MS,
      ),
      activeConversationPresenceAgeMs,
      heartbeatRecent: isRecent(heartbeatAgeMs, GLOBAL_HEARTBEAT_ONLINE_WINDOW_MS),
      heartbeatAgeMs,
    },
  };
}

function newestPresenceForRecipient(
  state: Record<string, GlobalPresencePayload[]>,
  recipientId: string,
) {
  return Object.values(state)
    .flat()
    .filter((presence) => presence?.user_id === recipientId)
    .sort((first, second) => {
      const firstTime = first.last_seen ? new Date(first.last_seen).getTime() : 0;
      const secondTime = second.last_seen ? new Date(second.last_seen).getTime() : 0;
      return secondTime - firstTime;
    })[0];
}

async function getGlobalRealtimePresenceSnapshot({
  service,
  recipientId,
}: {
  service: ServiceClient;
  recipientId: string;
}): Promise<GlobalPresenceSnapshot> {
  return new Promise((resolve) => {
    const channel = service.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: { presence: { key: `server-delivery-${randomUUID()}` } },
    });
    let settled = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    function finish(snapshot: GlobalPresenceSnapshot) {
      if (settled) return;
      settled = true;
      if (settleTimer) windowClearTimeout(settleTimer);
      void service.removeChannel(channel);
      resolve(snapshot);
    }

    function finishFromState(reason: string) {
      try {
        const state = channel.presenceState() as Record<string, GlobalPresencePayload[]>;
        const presence = newestPresenceForRecipient(state, recipientId);
        const presenceCount = Object.values(state)
          .flat()
          .filter((item) => item?.user_id === recipientId).length;
        const presenceAge = ageMs(presence?.last_seen);
        const online = presenceCount > 0 && isRecent(presenceAge, GLOBAL_REALTIME_PRESENCE_WINDOW_MS);

        finish({
          checked: true,
          online,
          reason: online
            ? "global_realtime_presence_recent"
            : presenceCount > 0
              ? "global_realtime_presence_stale"
              : reason,
          ageMs: presenceAge,
          activeConversationId: presence?.active_conversation_id ?? null,
          presenceCount,
          errorMessage: null,
        });
      } catch (error) {
        finish({
          checked: false,
          online: false,
          reason: "global_realtime_presence_snapshot_error",
          ageMs: null,
          activeConversationId: null,
          presenceCount: 0,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    settleTimer = setTimeout(() => {
      finish({
        checked: false,
        online: false,
        reason: "global_realtime_presence_timeout",
        ageMs: null,
        activeConversationId: null,
        presenceCount: 0,
        errorMessage: null,
      });
    }, GLOBAL_PRESENCE_SNAPSHOT_TIMEOUT_MS);

    channel
      .on("presence", { event: "sync" }, () => {
        finishFromState("global_realtime_presence_absent");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setTimeout(() => {
            finishFromState("global_realtime_presence_absent");
          }, 150);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          finish({
            checked: false,
            online: false,
            reason: `global_realtime_presence_${status.toLowerCase()}`,
            ageMs: null,
            activeConversationId: null,
            presenceCount: 0,
            errorMessage: null,
          });
        }
      });
  });
}

function windowClearTimeout(timer: ReturnType<typeof setTimeout>) {
  clearTimeout(timer);
}

export function offlineNotificationDeliveryState({
  recipientId,
  recipientType,
  reason,
}: {
  recipientId: string;
  recipientType: string;
  reason: string;
}) {
  return buildState({
    recipientId,
    recipientType,
    online: false,
    reason,
  });
}

export async function getNotificationDeliveryState({
  service,
  recipientId,
  recipientType,
  activeConversationId = null,
  requireRealtimePresence = false,
}: {
  service: ServiceClient;
  recipientId: string;
  recipientType: string;
  activeConversationId?: string | null;
  requireRealtimePresence?: boolean;
}): Promise<NotificationDeliveryState> {
  let activeConversationPresenceAge: number | null = null;
  let heartbeatAge: number | null = null;
  let lookupFailed = false;
  let globalPresence: GlobalPresenceSnapshot = {
    checked: false,
    online: false,
    reason: "global_realtime_presence_not_checked",
    ageMs: null,
    activeConversationId: null,
    presenceCount: 0,
    errorMessage: null,
  };

  if (requireRealtimePresence) {
    globalPresence = await getGlobalRealtimePresenceSnapshot({ service, recipientId });
    if (!globalPresence.checked && globalPresence.errorMessage) {
      logApiError("NOTIFICATION DELIVERY ERROR", {
        query: "global realtime presence snapshot",
        recipient_id: recipientId,
        recipient_type: recipientType,
        error: new Error(globalPresence.errorMessage),
      });
    }
  }

  if (activeConversationId) {
    const { data, error } = await service
      .from("conversation_active_presence")
      .select("active_at")
      .eq("conversation_id", activeConversationId)
      .eq("user_id", recipientId)
      .maybeSingle();

    if (error) {
      lookupFailed = true;
      logApiError("NOTIFICATION DELIVERY ERROR", {
        query: "conversation_active_presence select recipient",
        recipient_id: recipientId,
        recipient_type: recipientType,
        active_conversation_id: activeConversationId,
        error,
      });
    } else {
      activeConversationPresenceAge = ageMs(data?.active_at);
    }
  }

  const { data: activity, error: activityError } = await service
    .from("user_activity")
    .select("last_seen_at")
    .eq("user_id", recipientId)
    .maybeSingle();

  if (activityError) {
    lookupFailed = true;
    logApiError("NOTIFICATION DELIVERY ERROR", {
      query: "user_activity select recipient",
      recipient_id: recipientId,
      recipient_type: recipientType,
      error: activityError,
    });
  } else {
    heartbeatAge = ageMs(activity?.last_seen_at);
  }

  if (isRecent(activeConversationPresenceAge, ACTIVE_CONVERSATION_PRESENCE_WINDOW_MS)) {
    return buildState({
      recipientId,
      recipientType,
      online: true,
      reason: "active_conversation_presence_recent",
      presenceSource: "conversation_active_presence",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  if (globalPresence.online) {
    return buildState({
      recipientId,
      recipientType,
      online: true,
      reason: globalPresence.reason,
      presenceSource: "global_realtime_presence",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId: globalPresence.activeConversationId ?? activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  if (requireRealtimePresence) {
    return buildState({
      recipientId,
      recipientType,
      online: false,
      reason: globalPresence.reason,
      presenceSource: "global_realtime_presence",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId: globalPresence.activeConversationId ?? activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  if (lookupFailed) {
    return buildState({
      recipientId,
      recipientType,
      online: false,
      reason: "presence_lookup_failed_email_required",
      presenceSource: "server_presence_projection",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  if (!activeConversationId && isRecent(heartbeatAge, GLOBAL_HEARTBEAT_ONLINE_WINDOW_MS)) {
    return buildState({
      recipientId,
      recipientType,
      online: true,
      reason: "global_heartbeat_recent",
      presenceSource: "user_activity_heartbeat",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  if (activeConversationId && isRecent(heartbeatAge, GLOBAL_HEARTBEAT_ONLINE_WINDOW_MS)) {
    return buildState({
      recipientId,
      recipientType,
      online: false,
      reason: "heartbeat_recent_without_active_conversation_presence",
      presenceSource: "user_activity_heartbeat",
      globalPresenceAgeMs: globalPresence.ageMs,
      globalPresenceCount: globalPresence.presenceCount,
      activeConversationId,
      activeConversationPresenceAgeMs: activeConversationPresenceAge,
      heartbeatAgeMs: heartbeatAge,
    });
  }

  return buildState({
    recipientId,
    recipientType,
    online: false,
    reason: heartbeatAge === null ? "presence_not_available" : "heartbeat_expired",
    presenceSource: "user_activity_heartbeat",
    globalPresenceAgeMs: globalPresence.ageMs,
    globalPresenceCount: globalPresence.presenceCount,
    activeConversationId,
    activeConversationPresenceAgeMs: activeConversationPresenceAge,
    heartbeatAgeMs: heartbeatAge,
  });
}

export function combineNotificationDeliveryStates({
  recipientId,
  recipientType,
  states,
  fallbackReason,
}: {
  recipientId: string;
  recipientType: string;
  states: NotificationDeliveryState[];
  fallbackReason: string;
}) {
  if (states.length === 0) {
    return offlineNotificationDeliveryState({
      recipientId,
      recipientType,
      reason: fallbackReason,
    });
  }

  const onlineState = states.find((state) => state.online);

  return buildState({
    recipientId,
    recipientType,
    online: Boolean(onlineState),
    reason: onlineState
      ? `at_least_one_recipient_online:${onlineState.recipientId}`
      : "all_recipients_offline_or_ambiguous",
  });
}

export function logNotificationEmailDecision({
  scope,
  state,
  emailResult = null,
}: {
  scope: string;
  state: NotificationDeliveryState;
  emailResult?: EmailResultLog | null;
}) {
  console.info("[notification-delivery] Email decision", {
    scope,
    recipient_id: state.recipientId,
    recipient_type: state.recipientType,
    online: state.online,
    reason: state.reason,
    email_required: state.emailRequired,
    email_sent: emailResult?.sent === true,
    messageId: emailResult?.messageId ?? null,
    accepted: emailResult?.accepted ?? [],
    rejected: emailResult?.rejected ?? [],
    signals: state.signals,
  });
}
