import { loadDemoData } from "./demo";
import * as market from "./market";
import * as stores from "./stores";

// Development convenience: `window.__firenances.demo()` seeds sample data from the console.
export function exposeDevTools() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__firenances = { stores, market, demo: loadDemoData };
}
