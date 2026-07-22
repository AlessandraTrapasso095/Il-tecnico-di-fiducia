"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { fetchJson } from "@/lib/api/fetch-json";
import { createClient } from "@/lib/supabase/client";

type AuthenticatedRole = "customer" | "professional" | "admin";

type InactivityMessage =
  | { type: "activity"; timestamp: number }
  | { type: "logout"; timestamp: number };

const WARNING_AFTER_MS = 14 * 60 * 1000;
const LOGOUT_AFTER_MS = 15 * 60 * 1000;
const MIN_ACTIVITY_UPDATE_MS = 1000;
const MOUSE_MOVE_MIN_DISTANCE = 24;
const INACTIVITY_CHANNEL = "itdf-inactivity-timeout";
const STORAGE_EVENT_KEY = "itdf:inactivity-event";

function loginUrlForRole(role: AuthenticatedRole, pathname: string | null) {
  const params = new URLSearchParams({ reason: "inactive" });
  if (role === "admin") {
    return `/admin/login?${params.toString()}`;
  }

  params.set("role", role);
  if (pathname && pathname !== "/") {
    params.set("next", pathname);
  }

  return `/auth/login?${params.toString()}`;
}

function serializeMessage(message: InactivityMessage) {
  return JSON.stringify(message);
}

function parseMessage(value: string | null): InactivityMessage | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<InactivityMessage>;
    if (parsed.type !== "activity" && parsed.type !== "logout") return null;
    if (typeof parsed.timestamp !== "number") return null;
    return parsed as InactivityMessage;
  } catch {
    return null;
  }
}

export function InactivityTimeoutProvider({
  role,
  children,
}: {
  role: AuthenticatedRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const logoutInProgressRef = useRef(false);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const [warningVisible, setWarningVisible] = useState(false);

  const clearActiveTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const broadcast = useCallback((message: InactivityMessage) => {
    broadcastRef.current?.postMessage(message);
    try {
      window.localStorage.setItem(STORAGE_EVENT_KEY, serializeMessage(message));
    } catch {
      // Storage can be unavailable in private contexts; BroadcastChannel is enough when present.
    }
  }, []);

  const performLogout = useCallback(
    async (broadcastToTabs = true) => {
      if (logoutInProgressRef.current) return;
      logoutInProgressRef.current = true;
      clearActiveTimer();
      setWarningVisible(false);

      if (broadcastToTabs) {
        broadcast({ type: "logout", timestamp: Date.now() });
      }

      try {
        await fetchJson<{ ok: true }>("/api/auth/sign-out", { method: "POST" });
      } catch {
        // The client sign-out below still clears local auth state if the API is temporarily unavailable.
      }

      try {
        await supabase.removeAllChannels();
      } catch {
        // Best-effort Realtime cleanup.
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // The API sign-out is the source of truth for server cookies.
      }

      router.push(loginUrlForRole(role, pathname));
      router.refresh();
    },
    [broadcast, clearActiveTimer, pathname, role, router, supabase],
  );

  const scheduleNextBoundary = useCallback(() => {
    clearActiveTimer();
    const elapsed = Date.now() - lastActivityRef.current;

    if (elapsed >= LOGOUT_AFTER_MS) {
      timeoutRef.current = window.setTimeout(() => {
        void performLogout();
      }, 0);
      return;
    }

    if (elapsed >= WARNING_AFTER_MS) {
      setWarningVisible(true);
      timeoutRef.current = window.setTimeout(() => {
        void performLogout();
      }, LOGOUT_AFTER_MS - elapsed);
      return;
    }

    setWarningVisible(false);
    timeoutRef.current = window.setTimeout(() => {
      setWarningVisible(true);
      timeoutRef.current = window.setTimeout(() => {
        void performLogout();
      }, LOGOUT_AFTER_MS - WARNING_AFTER_MS);
    }, WARNING_AFTER_MS - elapsed);
  }, [clearActiveTimer, performLogout]);

  const markActivity = useCallback(
    (broadcastToTabs = true) => {
      if (logoutInProgressRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current < MIN_ACTIVITY_UPDATE_MS) return;
      lastActivityRef.current = now;
      setWarningVisible(false);
      scheduleNextBoundary();
      if (broadcastToTabs) {
        broadcast({ type: "activity", timestamp: lastActivityRef.current });
      }
    },
    [broadcast, scheduleNextBoundary],
  );

  useEffect(() => {
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(INACTIVITY_CHANNEL);
    broadcastRef.current = channel;

    function handleBroadcast(event: MessageEvent<InactivityMessage>) {
      const message = event.data;
      if (message.type === "activity") {
        lastActivityRef.current = Math.max(lastActivityRef.current, message.timestamp);
        setWarningVisible(false);
        scheduleNextBoundary();
      }
      if (message.type === "logout") {
        void performLogout(false);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_EVENT_KEY) return;
      const message = parseMessage(event.newValue);
      if (!message) return;
      if (message.type === "activity") {
        lastActivityRef.current = Math.max(lastActivityRef.current, message.timestamp);
        setWarningVisible(false);
        scheduleNextBoundary();
      }
      if (message.type === "logout") {
        void performLogout(false);
      }
    }

    channel?.addEventListener("message", handleBroadcast);
    window.addEventListener("storage", handleStorage);

    return () => {
      channel?.removeEventListener("message", handleBroadcast);
      channel?.close();
      broadcastRef.current = null;
      window.removeEventListener("storage", handleStorage);
    };
  }, [performLogout, scheduleNextBoundary]);

  useEffect(() => {
    function onActivity() {
      markActivity();
    }

    function onMouseMove(event: MouseEvent) {
      const previous = lastMouseRef.current;
      lastMouseRef.current = { x: event.clientX, y: event.clientY };
      if (!previous) return;

      const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
      if (distance >= MOUSE_MOVE_MIN_DISTANCE) {
        markActivity();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        markActivity();
      }
    }

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "input",
      "focus",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, onActivity, { passive: true }),
    );
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    lastActivityRef.current = Date.now();
    scheduleNextBoundary();

    return () => {
      clearActiveTimer();
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, onActivity),
      );
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clearActiveTimer, markActivity, scheduleNextBoundary]);

  return (
    <>
      {children}
      {warningVisible ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-inverse-surface/45 backdrop-blur-sm" />
          <div className="relative w-full max-w-[420px] rounded-[28px] border border-white/30 bg-surface-container-lowest p-5 text-on-surface shadow-2xl sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant">
              <span className="material-symbols-outlined" aria-hidden>
                timer
              </span>
            </div>
            <h2 className="mt-4 font-headline-sm text-[24px] text-primary">
              Sessione quasi scaduta
            </h2>
            <p className="mt-2 text-on-surface-variant">
              La sessione scadrà tra 1 minuto per inattività.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-full px-5 py-3 font-button text-primary transition hover:bg-primary-fixed"
                onClick={() => void performLogout()}
              >
                Esci
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B]"
                onClick={() => markActivity()}
              >
                Resta collegato
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
