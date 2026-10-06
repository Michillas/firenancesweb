"use client";

import { useSyncExternalStore } from "react";
import { todayKey } from "@/core/logic/dates";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = "";

function tick() {
  const next = todayKey();
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = todayKey();
    // Cheap check every 30 s: screens roll over to the new day without a reload.
    timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", tick);
    }
  };
}

// Today's local day key as reactive state (stable between renders, changes at midnight).
export function useToday(): string {
  return useSyncExternalStore(subscribe, () => (current = todayKey()), () => "1970-01-01");
}
