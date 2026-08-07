"use client";

import { useEffect, useRef } from "react";

const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_SYNC_MS = 60 * 1000;

export function InactivityGuard({ absoluteExpiresAt }: { absoluteExpiresAt: string }) {
  const timeout = useRef<number | null>(null);
  const absoluteTimeout = useRef<number | null>(null);
  const lastSynced = useRef(0);

  useEffect(() => {
    let disposed = false;
    lastSynced.current = Date.now();
    const expire = async () => {
      if (disposed) return;
      await fetch("/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
      window.location.replace("/admin/login?message=session-expired");
    };
    const resetTimer = () => {
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(expire, IDLE_MS);
    };
    const recordRelevantActivity = () => {
      resetTimer();
      if (Date.now() - lastSynced.current < ACTIVITY_SYNC_MS) return;
      lastSynced.current = Date.now();
      fetch("/admin/session/activity", { method: "POST", credentials: "same-origin" })
        .then((response) => {
          if (response.status === 401) window.location.replace("/admin/login?message=session-expired");
        })
        .catch(() => undefined);
    };

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "input", "touchstart", "pointerdown"];
    events.forEach((event) => window.addEventListener(event, recordRelevantActivity, { passive: true }));
    resetTimer();
    absoluteTimeout.current = window.setTimeout(
      expire,
      Math.max(0, new Date(absoluteExpiresAt).getTime() - Date.now()),
    );

    return () => {
      disposed = true;
      if (timeout.current) window.clearTimeout(timeout.current);
      if (absoluteTimeout.current) window.clearTimeout(absoluteTimeout.current);
      events.forEach((event) => window.removeEventListener(event, recordRelevantActivity));
    };
  }, [absoluteExpiresAt]);

  return null;
}
