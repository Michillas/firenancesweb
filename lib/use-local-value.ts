"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// A string preference kept in localStorage, readable synchronously (no effect, no flash) and
// shared between components and tabs. Per-device UI state only; real data lives in the stores.
export function useLocalValue(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  const read = () => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const write = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage unavailable: preference simply is not remembered
      }
      emit();
    },
    [key],
  );
  return [value, write];
}
