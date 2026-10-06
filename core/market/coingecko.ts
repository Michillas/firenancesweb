import { getJson, MarketError, type FetchLike, type HistoryPoint, type QuoteResult, type SearchResult } from "./types";

// CoinGecko public API (no key, ~30 req/min). Ids are slugs: "bitcoin", "ethereum".
const API = "https://api.coingecko.com/api/v3";

export async function coingeckoQuote(f: FetchLike, id: string, vs: string): Promise<QuoteResult> {
  const cur = vs.toLowerCase();
  const json = (await getJson(f, `${API}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${cur}&include_24hr_change=true&include_last_updated_at=true`)) as Record<string, Record<string, number>>;
  const row = json[id.toLowerCase()];
  const price = row?.[cur];
  if (typeof price !== "number") throw new MarketError(404, `CoinGecko does not know ${id}`);
  const pct = row[`${cur}_24h_change`] ?? 0;
  const prev = price / (1 + pct / 100);
  return {
    source: "coingecko",
    symbol: id.toLowerCase(),
    name: id.charAt(0).toUpperCase() + id.slice(1),
    price,
    currency: vs.toUpperCase(),
    change: price - prev,
    changePct: pct,
    asOf: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString(),
  };
}

export async function coingeckoHistory(f: FetchLike, id: string, vs: string, days = 365): Promise<HistoryPoint[]> {
  // The public API rejects anything older than 365 days (error 10012).
  const json = (await getJson(f, `${API}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${vs.toLowerCase()}&days=${Math.min(365, days)}&interval=daily`)) as { prices?: [number, number][] };
  const byDay = new Map<string, number>();
  for (const [ts, price] of json.prices ?? []) byDay.set(new Date(ts).toISOString().slice(0, 10), price);
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export async function coingeckoSearch(f: FetchLike, query: string): Promise<SearchResult[]> {
  const json = (await getJson(f, `${API}/search?query=${encodeURIComponent(query)}`)) as { coins?: { id: string; name: string; symbol: string; market_cap_rank?: number | null }[] };
  return (json.coins ?? []).slice(0, 6).map((c) => ({ source: "coingecko" as const, id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, assetType: "crypto" as const, exchange: c.market_cap_rank ? `#${c.market_cap_rank}` : "Crypto" }));
}
