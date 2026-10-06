import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { logDueRecurring, recordSnapshot, seedCategories } from "./actions/finance";
import { changeBus } from "./create-collection-store";
import { ensureFx, refreshQuotes } from "./market";
import { collections, docs } from "./stores";

// Persist pending debounced writes right away (tab hidden / closing / navigating away).
export function flushAll(): Promise<unknown> {
  return Promise.all([...collections.map((c) => c.flush()), ...docs.map((d) => d.flush())]).catch((e) => console.warn("[store] flush failed", e));
}

function registerFlushOnExit() {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => void flushAll());
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flushAll());
}

// Net-worth snapshot whenever money-relevant data changes (debounced).
function watchSnapshots() {
  const relevant = new Set(["accounts", "transactions", "holdings", "assets", "quotes", "fx"]);
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Throttled, not debounced: live prices change every second and would postpone it forever.
  changeBus.subscribe((e) => {
    if (!relevant.has(e.collection) || timer) return;
    timer = setTimeout(() => {
      timer = null;
      recordSnapshot();
    }, e.collection === "quotes" ? 30_000 : 2000);
  });
}

// Recurring charges and quotes refresh in the background while the app is open.
function startBackgroundLoops() {
  const tick = () => {
    logDueRecurring();
    void refreshQuotes();
  };
  setInterval(tick, 15 * 60_000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && tick());
}

export const bootStore = createStore<{ ready: boolean; error: string | null }>(() => ({ ready: false, error: null }));

let started: Promise<void> | null = null;

// Loads every collection from storage exactly once, then starts background work.
export function hydrateAll(): Promise<void> {
  return (started ??= (async () => {
    try {
      await Promise.all([...collections.map((c) => c.hydrate()), ...docs.map((d) => d.hydrate())]);
      seedCategories();
      logDueRecurring();
      registerFlushOnExit();
      watchSnapshots();
      startBackgroundLoops();
      bootStore.setState({ ready: true, error: null });
      void ensureFx().then(() => refreshQuotes()).then(() => recordSnapshot());
    } catch (error) {
      console.error("[boot] hydrate failed", error);
      bootStore.setState({ ready: true, error: error instanceof Error ? error.message : "Storage unavailable" });
    }
  })());
}

export const useBootReady = () => useStore(bootStore, (s) => s.ready);
export const useBootError = () => useStore(bootStore, (s) => s.error);

// Also start on module load in the browser: after a hot reload replaces this module, the new boot
// store would otherwise wait forever for a Providers effect that does not run again.
if (typeof window !== "undefined") void hydrateAll();
