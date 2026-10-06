import type { AssetType } from "../domain/finance";
import { BROWSER_HEADERS, MarketError, getJson, type FetchLike, type HistoryPoint, type MarketEvent, type NewsItem, type QuoteResult, type SearchResult } from "./types";

// Yahoo Finance covers European ETFs and funds (VWCE.DE, IWDA.AS, 0P0000...F). It rate-limits
// aggressively per IP, so every call tries both hosts and callers must treat failure as normal.
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

async function yahoo(f: FetchLike, path: string): Promise<unknown> {
  let last: unknown;
  for (const host of HOSTS) {
    try {
      return await getJson(f, host + path, BROWSER_HEADERS);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new MarketError(502, "Yahoo unavailable");
}

type ChartResponse = {
  chart?: {
    result?: {
      meta?: { symbol?: string; currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; longName?: string; shortName?: string; regularMarketTime?: number };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[]; adjclose?: { adjclose?: (number | null)[] }[] };
      events?: { dividends?: Record<string, { amount: number; date: number }>; splits?: Record<string, { date: number; splitRatio: string }> };
    }[];
    error?: { description?: string } | null;
  };
};

export function parseYahooChart(json: ChartResponse): { quote: QuoteResult; history: HistoryPoint[]; events: MarketEvent[] } {
  const r = json.chart?.result?.[0];
  const meta = r?.meta;
  if (!r || !meta || typeof meta.regularMarketPrice !== "number") throw new MarketError(404, json.chart?.error?.description ?? "No Yahoo data");
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const history: HistoryPoint[] = [];
  (r.timestamp ?? []).forEach((ts, i) => {
    const c = closes[i];
    if (typeof c === "number") history.push([new Date(ts * 1000).toISOString().slice(0, 10), c]);
  });
  // Previous close from the series is more reliable than meta for daily change.
  const prevClose = history.length >= 2 ? history[history.length - 2][1] : prev;
  const events: MarketEvent[] = Object.values(r.events?.dividends ?? {}).map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), kind: "dividend_payment" as const, title: "Dividendo", amount: d.amount, estimated: false }));
  for (const s of Object.values(r.events?.splits ?? {})) events.push({ date: new Date(s.date * 1000).toISOString().slice(0, 10), kind: "split", title: `Split ${s.splitRatio}`, amount: null, estimated: false });
  const price = meta.regularMarketPrice;
  return {
    quote: {
      source: "yahoo",
      symbol: meta.symbol ?? "",
      name: meta.longName ?? meta.shortName ?? meta.symbol ?? "",
      price,
      currency: meta.currency ?? "USD",
      change: price - prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    },
    history,
    events,
  };
}

export async function yahooChart(f: FetchLike, symbol: string, range = "5d") {
  const json = (await yahoo(f, `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=div%7Csplit`)) as ChartResponse;
  return parseYahooChart(json);
}

const TYPE_MAP: Record<string, AssetType> = { EQUITY: "stock", ETF: "etf", MUTUALFUND: "index_fund", CRYPTOCURRENCY: "crypto", INDEX: "other", FUTURE: "commodity" };

type SearchResponse = {
  quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }[];
  news?: { title?: string; link?: string; publisher?: string; providerPublishTime?: number }[];
};

export async function yahooSearch(f: FetchLike, query: string): Promise<{ results: SearchResult[]; news: NewsItem[] }> {
  const json = (await yahoo(f, `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=8&lang=es-ES&region=ES`)) as SearchResponse;
  return {
    results: (json.quotes ?? [])
      .filter((q) => q.symbol)
      .map((q) => ({ source: "yahoo" as const, id: q.symbol!, symbol: q.symbol!, name: q.longname ?? q.shortname ?? q.symbol!, assetType: TYPE_MAP[q.quoteType ?? ""] ?? "other", exchange: q.exchDisp ?? "" })),
    news: (json.news ?? []).filter((n) => n.title && n.link).map((n) => ({ title: n.title!, url: n.link!, source: n.publisher ?? "Yahoo Finance", publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : "" })),
  };
}
