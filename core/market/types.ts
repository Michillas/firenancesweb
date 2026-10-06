import type { AssetType } from "../domain/finance";
import type { MarketEvent, NewsItem, SocialPost } from "../domain/market";

export type FetchLike = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal; method?: string; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown>; headers: { get(name: string): string | null } }>;

export type MarketSource = "yahoo" | "nasdaq" | "coingecko" | "justetf" | "ft" | "ftstock";

export interface QuoteResult {
  source: MarketSource;
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePct: number;
  asOf: string;
}

export type HistoryPoint = [date: string, close: number];

export interface SearchResult {
  source: MarketSource;
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string;
}

export type { MarketEvent, NewsItem, SocialPost };

export class MarketError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

// Browser-like headers: several public endpoints reject requests without them.
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

export async function getJson(fetchImpl: FetchLike, url: string, headers: Record<string, string> = BROWSER_HEADERS): Promise<unknown> {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new MarketError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new MarketError(502, `Invalid JSON from ${new URL(url).host}`);
  }
}

export async function getText(fetchImpl: FetchLike, url: string, headers: Record<string, string> = BROWSER_HEADERS): Promise<string> {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new MarketError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

// "$1,332.95" / "+0.07" / "-1.20%" / "N/A" -> number
export function num(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return NaN;
  const n = Number(raw.replace(/[$,%+\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

// "10/29/2026" -> "2026-10-29"
export function usDate(raw: unknown): string | null {
  const m = typeof raw === "string" ? raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}
