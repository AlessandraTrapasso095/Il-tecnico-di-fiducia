"use client";

type RealtimeDebugState = {
  counts: Record<string, number>;
  activeChannels: Record<string, number>;
  lastEvents: Array<{
    at: string;
    event: string;
    detail: Record<string, unknown>;
  }>;
};

declare global {
  interface Window {
    __itdfRealtimeDebug?: RealtimeDebugState;
  }
}

function debugState() {
  if (typeof window === "undefined") return null;

  window.__itdfRealtimeDebug ??= {
    counts: {},
    activeChannels: {},
    lastEvents: [],
  };

  return window.__itdfRealtimeDebug;
}

export function logRealtimeDev(event: string, detail: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "development") return;

  const state = debugState();
  if (!state) return;

  const scope =
    typeof detail.scope === "string" && detail.scope.length > 0
      ? detail.scope
      : "global";
  const scopedEvent = `${event}:${scope}`;
  state.counts[event] = (state.counts[event] ?? 0) + 1;
  state.counts[scopedEvent] = (state.counts[scopedEvent] ?? 0) + 1;

  const channelName =
    typeof detail.channelName === "string" && detail.channelName.length > 0
      ? detail.channelName
      : null;

  if (channelName && event === "channel.created") {
    state.activeChannels[channelName] = (state.activeChannels[channelName] ?? 0) + 1;
  }

  if (channelName && event === "channel.removed") {
    state.activeChannels[channelName] = Math.max(
      0,
      (state.activeChannels[channelName] ?? 0) - 1,
    );
  }

  state.lastEvents = [
    {
      at: new Date().toISOString(),
      event,
      detail,
    },
    ...state.lastEvents,
  ].slice(0, 100);

  console.debug("[realtime-debug]", event, {
    ...detail,
    count: state.counts[event],
    scopeCount: state.counts[scopedEvent],
    activeChannels: state.activeChannels,
  });
}
