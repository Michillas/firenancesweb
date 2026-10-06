import type { AssetType } from "../domain/finance";
import { BROWSER_HEADERS, MarketError, getJson, getText, type FetchLike, type HistoryPoint, type QuoteResult, type SearchResult } from "./types";
import { decodeEntities } from "./news";

// European funds and ETFs by ISIN. justETF covers UCITS ETFs (quote + daily history);
// the FT tearsheet covers mutual/index funds (latest NAV), which no free API publishes.

type Num = { raw?: number } | undefined;
type JustEtfQuote = { latestQuote?: Num; latestQuoteDate?: string; previousQuote?: Num; dtdPrc?: Num; dtdAmt?: Num };

export async function justetfQuote(f: FetchLike, isin: string, vs: string): Promise<QuoteResult> {
  const id = isin.toUpperCase();
  const json = (await getJson(f, `https://www.justetf.com/api/etfs/${id}/quote?locale=en&currency=${vs}&isin=${id}`)) as JustEtfQuote;
  const price = json.latestQuote?.raw;
  if (typeof price !== "number") throw new MarketError(404, `justETF does not know ${id}`);
  return {
    source: "justetf",
    symbol: id,
    name: "",
    price,
    currency: vs.toUpperCase(),
    change: json.dtdAmt?.raw ?? 0,
    changePct: json.dtdPrc?.raw ?? 0,
    // Intraday quotes carry only today's date: stamp them now; older ones at the close.
    asOf: !json.latestQuoteDate || json.latestQuoteDate === new Date().toISOString().slice(0, 10) ? new Date().toISOString() : `${json.latestQuoteDate}T17:30:00.000Z`,
  };
}

export async function justetfHistory(f: FetchLike, isin: string, vs: string, days: number): Promise<HistoryPoint[]> {
  const id = isin.toUpperCase();
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const json = (await getJson(f, `https://www.justetf.com/api/etfs/${id}/performance-chart?locale=en&currency=${vs}&valuesType=MARKET_VALUE&reduceData=false&includeDividends=false&dateFrom=${from}`)) as { series?: { date: string; value?: Num }[] };
  const out = (json.series ?? []).filter((p) => typeof p.value?.raw === "number").map((p): HistoryPoint => [p.date, p.value!.raw!]);
  if (out.length === 0) throw new MarketError(404, `No justETF history for ${id}`);
  return out;
}

// Time-zone labels FT prints next to "as of" (hours from UTC).
const TZ_OFFSET: Record<string, number> = { GMT: 0, UTC: 0, BST: 1, CET: 1, CEST: 2, EST: -5, EDT: -4, JST: 9, HKT: 8, AEST: 10, AEDT: 11 };

export function parseFtTearsheet(html: string): { name: string; price: number; currency: string; change: number; changePct: number; asOf: string | null } {
  const price = html.match(/Price \(([A-Z]{3})\)<\/span><span class="mod-ui-data-list__value">([\d,.]+)</);
  if (!price) throw new MarketError(404, "No FT price");
  const name = decodeEntities(html.match(/mod-tearsheet-overview__header__name--large">([^<]+)</)?.[1] ?? "");
  const change = html.match(/Today's Change<\/span><span class="mod-ui-data-list__value"><span class="mod-format--(pos|neg|neutral)">(?:<i[^>]*><\/i>)?([\d,.-]+) \/ ([\d,.-]+)%/);
  const sign = change?.[1] === "neg" ? -1 : 1;
  const asOf = html.match(/as of ([A-Z][a-z]{2} \d{2} \d{4})(?: (\d{1,2}:\d{2}) ([A-Z]{2,4}))?/i);
  const offset = asOf?.[3] ? (TZ_OFFSET[asOf[3].toUpperCase()] ?? 0) : 0;
  const parsedDate = asOf ? new Date(new Date(`${asOf[1]} ${asOf[2] ?? "18:00"} UTC`).getTime() - offset * 3_600_000) : null;
  return {
    name,
    price: Number(price[2].replace(/,/g, "")),
    currency: price[1],
    change: change ? sign * Math.abs(Number(change[2].replace(/,/g, ""))) : 0,
    changePct: change ? sign * Math.abs(Number(change[3].replace(/,/g, ""))) : 0,
    asOf: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
  };
}

export async function ftFundQuote(f: FetchLike, isin: string, vs: string): Promise<QuoteResult> {
  const id = isin.toUpperCase();
  for (const cur of [vs.toUpperCase(), "EUR", "USD", "GBP"].filter((c, i, a) => a.indexOf(c) === i)) {
    try {
      const html = await getText(f, `https://markets.ft.com/data/funds/tearsheet/summary?s=${id}:${cur}`);
      const r = parseFtTearsheet(html);
      return { source: "ft", symbol: id, name: r.name, price: r.price, currency: r.currency, change: r.change, changePct: r.changePct, asOf: r.asOf ?? new Date().toISOString() };
    } catch {
      // try the next share-class currency
    }
  }
  throw new MarketError(404, `FT does not know ${id}`);
}

// ---- Global equities and ETFs (FT "markets data": Tokyo, Stockholm, Madrid, London...) ----------
// Prices are delayed (~15 min) by the exchanges' free-data rules; history comes from FT's chart API.

const FT = "https://markets.ft.com/data";
const ASSET_CLASS: Record<string, AssetType> = { Equities: "stock", ETFs: "etf", Funds: "index_fund", Indices: "other" };

type FtSearch = { data?: { security?: { name?: string; symbol?: string; isPrimary?: boolean; assetClass?: string }[] } };

export async function ftSearch(f: FetchLike, query: string): Promise<SearchResult[]> {
  const json = (await getJson(f, `${FT}/searchapi/searchsecurities?query=${encodeURIComponent(query)}`)) as FtSearch;
  return (json.data?.security ?? [])
    .filter((s) => s.symbol && s.name && (s.assetClass === "Equities" || s.assetClass === "ETFs"))
    .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))
    .slice(0, 8)
    .map((s) => ({ source: "ftstock" as const, id: s.symbol!, symbol: s.symbol!, name: s.name!, assetType: ASSET_CLASS[s.assetClass ?? ""] ?? "stock", exchange: s.symbol!.split(":")[1] ?? "" }));
}

async function ftTearsheet(f: FetchLike, symbol: string): Promise<string> {
  for (const kind of ["equities", "etfs"]) {
    const html = await getText(f, `${FT}/${kind}/tearsheet/summary?s=${encodeURIComponent(symbol)}`).catch(() => "");
    if (/Price \([A-Z]{3}\)/.test(html)) return html;
  }
  throw new MarketError(404, `FT does not know ${symbol}`);
}

export async function ftStockQuote(f: FetchLike, symbol: string): Promise<QuoteResult> {
  const r = parseFtTearsheet(await ftTearsheet(f, symbol));
  return { source: "ftstock", symbol, name: r.name, price: r.price, currency: r.currency, change: r.change, changePct: r.changePct, asOf: r.asOf ?? new Date().toISOString() };
}

type FtChart = { Dates?: string[]; Elements?: { ComponentSeries?: { Type: string; Values: (number | null)[] }[] }[] };

export async function ftStockHistory(f: FetchLike, symbol: string, days: number): Promise<HistoryPoint[]> {
  const xid = (await ftTearsheet(f, symbol)).match(/&quot;xid&quot;:&quot;(\d+)&quot;/)?.[1];
  if (!xid) throw new MarketError(404, `No FT id for ${symbol}`);
  const res = await f(`${FT}/chartapi/series`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ days, dataNormalized: false, dataPeriod: "Day", dataInterval: 1, realtime: false, yFormat: "0.###", timeServiceFormat: "JSON", returnDateType: "ISO8601", elements: [{ Label: "p", Type: "price", Symbol: xid, OverlayIndicators: [], Params: {} }] }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new MarketError(res.status, "FT chart unavailable");
  return parseFtChart((await res.json()) as FtChart);
}

export function parseFtChart(json: FtChart): HistoryPoint[] {
  const close = json.Elements?.[0]?.ComponentSeries?.find((c) => c.Type === "Close")?.Values ?? [];
  return (json.Dates ?? []).map((d, i): HistoryPoint | null => (typeof close[i] === "number" ? [d.slice(0, 10), close[i] as number] : null)).filter((p): p is HistoryPoint => p !== null);
}

// Yahoo suffix -> FT exchange code, for the automatic fallback when Yahoo rate-limits.
export const YAHOO_TO_FT: Record<string, string> = { T: "TYO", ST: "STO", MC: "MCE", PA: "PAR", L: "LSE", AS: "AEX" };

export function yahooToFt(id: string): string | null {
  const m = id.toUpperCase().match(/^(.+)\.([A-Z]+)$/);
  const code = m ? YAHOO_TO_FT[m[2]] : undefined;
  return m && code ? `${m[1]}:${code}` : null;
}
