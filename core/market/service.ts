import type { MarketEvent } from "../domain/market";
import { coingeckoHistory, coingeckoQuote, coingeckoSearch } from "./coingecko";
import { nasdaqEvents, nasdaqHistory, nasdaqQuote, nasdaqSearch } from "./nasdaq";
import { ftFundQuote, ftSearch, ftStockHistory, ftStockQuote, justetfHistory, justetfQuote, yahooToFt } from "./europe";
import { blueskySearch, fxRates, googleNews } from "./news";
import { MarketError, type FetchLike, type HistoryPoint, type MarketSource, type NewsItem, type QuoteResult, type SearchResult, type SocialPost } from "./types";
import { yahooChart, yahooSearch } from "./yahoo";

export * from "./types";

const RANGE_DAYS: Record<string, number> = { "1mo": 31, "6mo": 183, "1y": 366, "5y": 1827 };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// One entry point for every market call, with provider fallbacks. The Next API route wraps it.
export function createMarket(f: FetchLike) {
  // ISIN fallbacks for European products when the ticker route fails (Yahoo rate limits a lot).
  async function byIsin(isin: string, vs: string): Promise<QuoteResult> {
    try {
      return await justetfQuote(f, isin, vs);
    } catch {
      return ftFundQuote(f, isin, vs);
    }
  }

  async function quote(source: MarketSource, id: string, vs = "EUR", isin?: string): Promise<QuoteResult> {
    if (source === "coingecko") return coingeckoQuote(f, id, vs);
    if (source === "justetf") return byIsin(id, vs);
    if (source === "ft") return ftFundQuote(f, id, vs);
    if (source === "ftstock") return ftStockQuote(f, id);
    if (source === "nasdaq") {
      try {
        return await nasdaqQuote(f, id);
      } catch {
        return (await yahooChart(f, id)).quote;
      }
    }
    try {
      return (await yahooChart(f, id)).quote;
    } catch (error) {
      const ft = yahooToFt(id);
      if (ft) return ftStockQuote(f, ft).catch(() => (isin ? byIsin(isin, vs) : Promise.reject(error)));
      if (isin) return byIsin(isin, vs);
      // US tickers still work through Nasdaq when Yahoo is rate limiting.
      if (!/[.=^]/.test(id)) return nasdaqQuote(f, id);
      throw error;
    }
  }

  async function history(source: MarketSource, id: string, range = "1y", vs = "EUR", isin?: string): Promise<HistoryPoint[]> {
    const days = RANGE_DAYS[range] ?? 366;
    if (source === "coingecko") return coingeckoHistory(f, id, vs, days);
    if (source === "justetf") return justetfHistory(f, id, vs, days);
    if (source === "ft") return [];
    if (source === "ftstock") return ftStockHistory(f, id, days);
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    if (source === "nasdaq") {
      try {
        return await nasdaqHistory(f, id, ymd(from), ymd(to));
      } catch {
        return (await yahooChart(f, id, range)).history;
      }
    }
    try {
      return (await yahooChart(f, id, range)).history;
    } catch (error) {
      const ft = yahooToFt(id);
      if (ft) return ftStockHistory(f, ft, days);
      if (isin) return justetfHistory(f, isin, vs, days);
      if (!/[.=^]/.test(id)) return nasdaqHistory(f, id, ymd(from), ymd(to));
      throw error;
    }
  }

  async function events(source: MarketSource, id: string): Promise<MarketEvent[]> {
    if (source === "coingecko" || source === "justetf" || source === "ft" || source === "ftstock") return [];
    const out: MarketEvent[] = [];
    if (!/[.=^]/.test(id)) out.push(...(await nasdaqEvents(f, id).catch(() => [])));
    if (out.length === 0) out.push(...(await yahooChart(f, id, "2y").then((r) => r.events).catch(() => [])));
    return out;
  }

  async function search(query: string): Promise<SearchResult[]> {
    // FT first: it covers every exchange (Tokyo, Stockholm, Madrid...) and is not rate limited like Yahoo.
    const settled = await Promise.allSettled([ftSearch(f, query), nasdaqSearch(f, query), yahooSearch(f, query).then((r) => r.results), coingeckoSearch(f, query)]);
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      for (const r of s.value) {
        const key = `${r.source}:${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(r);
        }
      }
    }
    if (out.length === 0 && settled.every((s) => s.status === "rejected")) throw new MarketError(502, "Search providers unavailable");
    return out;
  }

  async function news(query: string, symbol?: string): Promise<NewsItem[]> {
    const settled = await Promise.allSettled([googleNews(f, query, "es"), googleNews(f, query, "en"), symbol ? yahooSearch(f, symbol).then((r) => r.news) : Promise.resolve([])]);
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      for (const n of s.value) {
        const key = n.title.toLowerCase().slice(0, 80);
        if (seen.has(key) || seen.has(n.url)) continue;
        seen.add(key);
        seen.add(n.url);
        out.push(n);
      }
    }
    return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
  }

  async function social(query: string): Promise<SocialPost[]> {
    const [top, latest] = await Promise.allSettled([blueskySearch(f, query, "top"), blueskySearch(f, query, "latest")]);
    const seen = new Set<string>();
    const out: SocialPost[] = [];
    // Recent conversation first; popular posts only if they are from the last 60 days.
    const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
    if (top.status === "fulfilled") top.value = top.value.filter((p) => p.publishedAt >= cutoff);
    for (const s of [latest, top]) {
      if (s.status !== "fulfilled") continue;
      for (const p of s.value) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        out.push(p);
      }
    }
    if (top.status === "rejected" && latest.status === "rejected") throw new MarketError(502, "Social search unavailable");
    return out.slice(0, 30);
  }

  return { quote, history, events, search, news, social, fx: (base: string) => fxRates(f, base) };
}

export type Market = ReturnType<typeof createMarket>;
