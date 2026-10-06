import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Holding } from "@/core/domain/finance";
import type { Quote } from "@/core/domain/market";
import { holdingQuoteKey, resolveSource } from "@/core/logic/networth";
import type { QuoteResult } from "@/core/market/types";
import { api, isinParam, priceId } from "./market";
import { holdings, quotes, settings } from "./stores";

// Real-time prices while the app is open:
//  - crypto: Binance public WebSocket (every trade-second, no key),
//  - US stocks/ETFs: Nasdaq every 15 s from 04:00 to 20:00 New York time (pre, regular and after hours),
//  - European ETFs (justETF / Yahoo .DE ...): every 30 s from 08:00 to 22:00 Berlin time.
// Index funds publish one NAV per day, so they stay on the regular refresh.

export interface LiveState {
  crypto: "off" | "connecting" | "live";
  // Venues currently trading that hold one of your positions ("EE. UU.", "Tokio"...).
  open: string[];
  // True when some open venue only has delayed (~15 min) free data.
  delayed: boolean;
  lastTick: number | null;
}

export const liveStore = createStore<LiveState>(() => ({ crypto: "off", open: [], delayed: false, lastTick: null }));
export const useLive = <T,>(selector: (s: LiveState) => T) => useStore(liveStore, selector);

const BINANCE_REST = "https://data-api.binance.vision/api/v3";
const BINANCE_WS = "wss://data-stream.binance.vision/stream?streams=";
const CRYPTO_THROTTLE = 1_500;

function writeQuote(key: string, r: Pick<QuoteResult, "price" | "change" | "changePct" | "currency"> & { source: string; symbol: string; name?: string }) {
  const prev = quotes.get(key);
  if (prev && Math.abs(prev.price - r.price) < 1e-9 && prev.live) return;
  const tick: Quote["tick"] = prev ? (r.price > prev.price ? "up" : r.price < prev.price ? "down" : prev.tick) : null;
  quotes.upsert(key, {
    source: r.source,
    symbol: r.symbol,
    name: r.name || prev?.name || "",
    price: r.price,
    currency: r.currency,
    change: r.change,
    changePct: r.changePct,
    asOf: new Date().toISOString(),
    history: prev?.history ?? [],
    historyAt: prev?.historyAt ?? null,
    tick,
    live: true,
  });
  liveStore.setState({ lastTick: Date.now() });
}

// Wall-clock hour (fractional) and weekday in a market's time zone.
function marketClock(timeZone: string, now = new Date()): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { hour: Number(get("hour")) + Number(get("minute")) / 60, weekday };
}

interface Session {
  label: string;
  zone: string;
  open: number;
  close: number;
  every: number;
  delayed: boolean;
}

// Trading hours per venue (local time, extended sessions where the free feed covers them).
const SESSIONS: Record<string, Session> = {
  us: { label: "EE. UU.", zone: "America/New_York", open: 4, close: 20, every: 15_000, delayed: false },
  eu: { label: "Europa", zone: "Europe/Berlin", open: 8, close: 22, every: 30_000, delayed: false },
  TYO: { label: "Tokio", zone: "Asia/Tokyo", open: 9, close: 15.5, every: 60_000, delayed: true },
  STO: { label: "Estocolmo", zone: "Europe/Stockholm", open: 9, close: 17.5, every: 60_000, delayed: true },
  MCE: { label: "Madrid", zone: "Europe/Madrid", open: 9, close: 17.5, every: 60_000, delayed: true },
  PAR: { label: "París", zone: "Europe/Paris", open: 9, close: 17.5, every: 60_000, delayed: true },
  AEX: { label: "Ámsterdam", zone: "Europe/Amsterdam", open: 9, close: 17.5, every: 60_000, delayed: true },
  LSE: { label: "Londres", zone: "Europe/London", open: 8, close: 16.5, every: 60_000, delayed: true },
  NYQ: { label: "EE. UU.", zone: "America/New_York", open: 9.5, close: 16, every: 60_000, delayed: true },
  NSQ: { label: "EE. UU.", zone: "America/New_York", open: 9.5, close: 16, every: 60_000, delayed: true },
  other: { label: "otras bolsas", zone: "Europe/Berlin", open: 8, close: 22, every: 60_000, delayed: true },
};

export function sessionOpen(s: Session, now = new Date()): boolean {
  const { hour, weekday } = marketClock(s.zone, now);
  return weekday >= 1 && weekday <= 5 && hour >= s.open && hour < s.close;
}

type Venue = "crypto" | Session | null;

function venueOf(h: Holding): Venue {
  if (h.archived || !holdingQuoteKey(h)) return null;
  const source = resolveSource(h);
  const id = priceId(h).toUpperCase();
  if (source === "coingecko") return "crypto";
  if (source === "nasdaq") return SESSIONS.us;
  if (source === "justetf") return SESSIONS.eu;
  if (source === "ftstock") return SESSIONS[id.split(":")[1] ?? ""] ?? SESSIONS.other;
  if (source === "yahoo") {
    const suffix = id.match(/\.([A-Z]+)$/)?.[1];
    if (!suffix) return SESSIONS.us;
    const ft = ({ T: "TYO", ST: "STO", MC: "MCE", PA: "PAR", AS: "AEX", L: "LSE" } as Record<string, string>)[suffix];
    return ft ? SESSIONS[ft] : SESSIONS.eu;
  }
  return null; // ft (daily fund NAV), manual
}

// ---- Crypto: Binance WebSocket ---------------------------------------------------------------

interface Pair {
  pair: string;
  currency: string;
  keys: string[];
}

async function resolvePair(symbol: string, currency: string): Promise<{ pair: string; currency: string } | null> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!sym) return null;
  const candidates: [string, string][] = [[`${sym}${currency}`, currency], [`${sym}USDT`, "USD"]];
  for (const [pair, cur] of candidates) {
    try {
      const res = await fetch(`${BINANCE_REST}/ticker/price?symbol=${pair}`);
      if (res.ok) return { pair, currency: cur };
    } catch {
      return null;
    }
  }
  return null;
}

function startCrypto(list: Holding[]): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const lastWrite = new Map<string, number>();

  const connect = async () => {
    const pairs = new Map<string, Pair>();
    for (const h of list) {
      const key = holdingQuoteKey(h)!;
      const found = await resolvePair(h.symbol || h.priceId, h.currency || settings.get().currency);
      if (!found) continue;
      const entry = pairs.get(found.pair) ?? { ...found, keys: [] };
      if (!entry.keys.includes(key)) entry.keys.push(key);
      pairs.set(found.pair, entry);
    }
    if (stopped || pairs.size === 0) {
      liveStore.setState({ crypto: "off" });
      return;
    }
    liveStore.setState({ crypto: "connecting" });
    socket = new WebSocket(BINANCE_WS + [...pairs.keys()].map((p) => `${p.toLowerCase()}@ticker`).join("/"));
    socket.onopen = () => {
      retry = 0;
      liveStore.setState({ crypto: "live" });
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { data?: { s?: string; c?: string; p?: string; P?: string } };
      const d = msg.data;
      const entry = d?.s ? pairs.get(d.s) : undefined;
      if (!d || !entry) return;
      const now = Date.now();
      if (now - (lastWrite.get(entry.pair) ?? 0) < CRYPTO_THROTTLE) return;
      lastWrite.set(entry.pair, now);
      const price = Number(d.c);
      if (!Number.isFinite(price)) return;
      for (const key of entry.keys) writeQuote(key, { source: "binance", symbol: entry.pair, price, change: Number(d.p) || 0, changePct: Number(d.P) || 0, currency: entry.currency });
    };
    socket.onclose = () => {
      socket = null;
      if (stopped) return;
      liveStore.setState({ crypto: "connecting" });
      retry = Math.min(retry + 1, 6);
      retryTimer = setTimeout(() => void connect(), 1000 * 2 ** retry);
    };
  };

  void connect();
  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
    liveStore.setState({ crypto: "off" });
  };
}

// ---- Stocks / ETFs: polling while each venue is open ------------------------------------------

function startPolling(): () => void {
  const lastPoll = new Map<string, number>();
  let busy = false;
  const tick = async () => {
    const venues = holdings.list().map((h) => ({ h, v: venueOf(h) })).filter((x): x is { h: Holding; v: Session } => x.v !== null && x.v !== "crypto");
    const openNow = venues.filter((x) => sessionOpen(x.v));
    liveStore.setState({ open: [...new Set(openNow.map((x) => x.v.label))], delayed: openNow.some((x) => x.v.delayed) });
    // No requests while the tab is in the background; the interval resumes on return.
    if (busy || document.visibilityState !== "visible") return;
    busy = true;
    const seen = new Set<string>();
    try {
      for (const { h, v } of openNow) {
        const key = holdingQuoteKey(h)!;
        if (seen.has(key)) continue;
        seen.add(key);
        if (Date.now() - (lastPoll.get(key) ?? 0) < v.every - 500) continue;
        lastPoll.set(key, Date.now());
        try {
          const r = await api<QuoteResult>("live", { source: resolveSource(h), id: priceId(h), vs: h.currency || settings.get().currency, ...isinParam(h) });
          writeQuote(key, { ...r, source: r.source });
        } catch {
          // Keep the last price; the next round tries again.
        }
      }
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 5_000);
  return () => clearInterval(timer);
}

let stopAll: (() => void) | null = null;
let cryptoSignature = "";

// Starts (or restarts when the crypto list changes) the live feeds. Idempotent.
export function startLive(): () => void {
  const sync = () => {
    const crypto = holdings.list().filter((h) => venueOf(h) === "crypto");
    const signature = crypto.map((h) => `${h.id}:${h.symbol}:${h.currency}`).sort().join("|");
    if (signature === cryptoSignature && stopAll) return;
    cryptoSignature = signature;
    stopCrypto?.();
    stopCrypto = crypto.length ? startCrypto(crypto) : null;
  };
  let stopCrypto: (() => void) | null = null;
  const stopPolling = startPolling();
  stopAll = () => {
    stopPolling();
    stopCrypto?.();
  };
  sync();
  const unsub = holdings.store.subscribe(() => sync());
  return () => {
    unsub();
    stopAll?.();
    stopAll = null;
    cryptoSignature = "";
  };
}
