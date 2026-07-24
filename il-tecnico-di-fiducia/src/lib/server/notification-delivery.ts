import "server-only";

import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

type EmailResultLog = {
  sent?: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

export type NotificationDeliveryState = {
  recipientId: string;
  recipientType: string;
  online: boolean;
  reason: string;
  emailRequired: boolean;
  signals: {
    activeConversationId: string | null;
    activeConversationPresenceRecent: boolean;
    activeConversationPresenceAgeMs: number | null;
    heartbeatRecent: boolean;
    heartbeatAgeMs: number | null;
  };
};

const ACTIVE_CONVERSATION_PRESENCE_WINDOW_MS = 75 * 1000;
const GLOBAL_HEARTBEAT_ONLINE_WINDOW_MS = 90 * 1000;

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
  activeConversationId = null,
  activeConversationPresenceAgeMs = null,
  heartbeatAgeMs = null,
}: {
  recipientId: string;
  recipientType: string;
  online: boolean;
  reason: string;
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
}: {
  service: ServiceClient;
  recipientId: string;
  recipientType: string;
  activeConversationId?: string | null;
}): Promise<NotificationDeliveryState> {
  let activeConversationPresenceAge: number | null = null;
  let heartbeatAge: number | null = null;
  let lookupFailed = false;

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
      activeConversationId,
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
