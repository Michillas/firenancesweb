import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Holding } from "@/core/domain/finance";
import type { MarketEvent, NewsItem, Quote, SocialPost } from "@/core/domain/market";
import { holdingQuoteKey, priceIdOf, resolveSource } from "@/core/logic/networth";
import type { HistoryPoint, QuoteResult, SearchResult } from "@/core/market/types";
import { feeds, fxRates, holdings, quotes, settings } from "./stores";

export class MarketUnavailable extends Error {}

export async function api<T>(op: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ op, ...params });
  let res: Response;
  try {
    res = await fetch(`/api/market?${qs}`, { cache: "no-store" });
  } catch {
    throw new MarketUnavailable("offline");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok || json.data === undefined) throw new MarketUnavailable(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

export const marketStatus = createStore<{ refreshing: boolean; lastError: string | null; lastRun: number | null }>(() => ({ refreshing: false, lastError: null, lastRun: null }));
export const useMarketStatus = <T,>(selector: (s: ReturnType<typeof marketStatus.getState>) => T) => useStore(marketStatus, selector);

const QUOTE_TTL = 15 * 60_000;
const FEED_TTL = 3 * 3600_000;
const HISTORY_TTL = 12 * 3600_000;
const FX_TTL = 12 * 3600_000;

export const priceId = (h: Holding) => priceIdOf(h);
// Lets the server fall back to ISIN-based sources when a ticker provider fails.
export const isinParam = (h: Holding): Record<string, string> => (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(h.isin.trim().toUpperCase()) ? { isin: h.isin.trim().toUpperCase() } : {});

export async function ensureFx(force = false): Promise<void> {
  const base = settings.get().currency;
  const current = fxRates.get(base);
  if (!force && current && Date.now() - new Date(current.updatedAt).getTime() < FX_TTL) return;
  try {
    const r = await api<{ base: string; date: string; rates: Record<string, number> }>("fx", { base });
    fxRates.upsert(base, { base, rates: r.rates, date: r.date });
  } catch {
    // Without rates every amount is treated as base currency; the UI says so.
  }
}

function saveQuote(key: string, r: QuoteResult, previous?: Quote) {
  quotes.upsert(key, {
    source: r.source,
    symbol: r.symbol,
    name: r.name,
    price: r.price,
    currency: r.currency,
    change: r.change,
    changePct: r.changePct,
    asOf: r.asOf,
    history: previous?.history ?? [],
    historyAt: previous?.historyAt ?? null,
    tick: previous ? (r.price > previous.price ? "up" : r.price < previous.price ? "down" : previous.tick) : null,
    live: false,
  });
}

async function quoteFor(h: Holding): Promise<void> {
  const key = holdingQuoteKey(h);
  if (!key) return;
  const r = await api<QuoteResult>("quote", { source: resolveSource(h), id: priceId(h), vs: h.currency || settings.get().currency, ...isinParam(h) });
  saveQuote(key, r, quotes.get(key));
}

let running: Promise<{ ok: number; failed: string[] }> | null = null;

// Refreshes every priced holding (deduplicated by quote key), three at a time. A call made while a
// refresh is running waits for it and then runs again, so holdings added meanwhile are not skipped.
export async function refreshQuotes(opts: { force?: boolean } = {}): Promise<{ ok: number; failed: string[] }> {
  while (running) await running.catch(() => undefined);
  running = runRefresh(opts).finally(() => {
    running = null;
  });
  return running;
}

async function runRefresh(opts: { force?: boolean }): Promise<{ ok: number; failed: string[] }> {
  marketStatus.setState({ refreshing: true, lastError: null });
  void ensureFx(opts.force);
  const seen = new Set<string>();
  const queue = holdings.list().filter((h) => {
    const key = holdingQuoteKey(h);
    if (!key || h.archived || seen.has(key)) return false;
    seen.add(key);
    const q = quotes.get(key);
    // Live feeds keep these fresh; a slower snapshot source would only make the price jump back.
    if (q?.live && Date.now() - new Date(q.updatedAt).getTime() < 120_000) return false;
    return opts.force || !q || Date.now() - new Date(q.updatedAt).getTime() > QUOTE_TTL;
  });
  let ok = 0;
  const failed: string[] = [];
  const worker = async () => {
    for (let h = queue.shift(); h; h = queue.shift()) {
      try {
        await quoteFor(h);
        ok++;
      } catch {
        failed.push(h.name);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  marketStatus.setState({ refreshing: false, lastRun: Date.now(), lastError: failed.length ? `Sin precio: ${failed.join(", ")}` : null });
  return { ok, failed };
}

export async function refreshHistory(h: Holding, range: "1mo" | "6mo" | "1y" | "5y" = "1y", force = false): Promise<HistoryPoint[]> {
  const key = holdingQuoteKey(h);
  if (!key) return [];
  const existing = quotes.get(key);
  if (!force && range === "1y" && existing?.historyAt && Date.now() - new Date(existing.historyAt).getTime() < HISTORY_TTL && existing.history.length) return existing.history;
  const history = await api<HistoryPoint[]>("history", { source: resolveSource(h), id: priceId(h), range, vs: h.currency || settings.get().currency, ...isinParam(h) });
  if (range === "1y") {
    if (existing) quotes.update(key, { history, historyAt: new Date().toISOString() });
    else {
      const last = history.at(-1);
      if (last) quotes.upsert(key, { source: resolveSource(h), symbol: priceId(h), name: h.name, price: last[1], currency: h.currency, change: 0, changePct: 0, asOf: `${last[0]}T00:00:00.000Z`, history, historyAt: new Date().toISOString() });
    }
  }
  return history;
}

export function newsQueryOf(h: Holding): string {
  if (h.newsQuery.trim()) return h.newsQuery.trim();
  const sym = h.symbol.split(".")[0];
  if (h.assetType === "crypto") return `${h.name} crypto`;
  if (h.assetType === "stock" && sym) return `${h.name.replace(/\b(Inc|Corp|Corporation|S\.?A\.?|plc|Ltd|N\.?V\.?)\b\.?/gi, "").trim()} ${sym} acciones`;
  return h.name;
}

export function socialQueryOf(h: Holding): string {
  const sym = h.symbol.split(".")[0].toUpperCase();
  if (sym && (h.assetType === "stock" || h.assetType === "crypto" || h.assetType === "etf")) return `$${sym}`;
  return h.name;
}

// News, social posts and corporate events for one holding (cached ~3 h).
export async function refreshFeed(h: Holding, force = false): Promise<void> {
  const current = feeds.get(h.id);
  if (!force && current?.fetchedAt && Date.now() - new Date(current.fetchedAt).getTime() < FEED_TTL) return;
  const id = priceId(h);
  const source = resolveSource(h);
  const [news, social, events] = await Promise.all([
    api<NewsItem[]>("news", { q: newsQueryOf(h), ...(h.symbol && source !== "coingecko" ? { symbol: h.symbol } : {}) }).catch(() => current?.news ?? []),
    api<SocialPost[]>("social", { q: socialQueryOf(h) }).catch(() => current?.social ?? []),
    id && (source === "nasdaq" || source === "yahoo") ? api<MarketEvent[]>("events", { source, id }).catch(() => current?.events ?? []) : Promise.resolve([] as MarketEvent[]),
  ]);
  feeds.upsert(h.id, { holdingId: h.id, news, social, events, fetchedAt: new Date().toISOString() });
}

export async function refreshAllHistory(): Promise<void> {
  const seen = new Set<string>();
  for (const h of holdings.list()) {
    const key = holdingQuoteKey(h);
    if (!key || h.archived || seen.has(key)) continue;
    seen.add(key);
    await refreshHistory(h).catch(() => undefined);
  }
}

export async function refreshAllFeeds(force = false): Promise<void> {
  const list = holdings.list().filter((h) => !h.archived);
  for (const h of list) await refreshFeed(h, force).catch(() => undefined);
}

export const searchAssets = (q: string) => api<SearchResult[]>("search", { q });
export const fetchQuote = (h: Holding) => api<QuoteResult>("quote", { source: resolveSource(h), id: priceId(h), vs: h.currency || settings.get().currency, ...isinParam(h) });

// Quote for a search result before it becomes a holding (to learn its trading currency).
export const quoteBySource = (source: string, id: string, vs: string) => api<QuoteResult>("quote", { source, id, vs });
