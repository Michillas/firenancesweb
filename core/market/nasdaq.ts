import type { AssetType } from "../domain/finance";
import { MarketError, getJson, num, usDate, type FetchLike, type HistoryPoint, type MarketEvent, type QuoteResult, type SearchResult } from "./types";

// api.nasdaq.com: US stocks and ETFs, no key. The asset class must match, so we try both.
const API = "https://api.nasdaq.com/api";
const CLASSES = ["stocks", "etf"] as const;

type Primary = { lastSalePrice?: string; netChange?: string; percentageChange?: string; lastTradeTimestamp?: string };
type InfoResponse = { data?: { symbol?: string; companyName?: string; primaryData?: Primary } | null };

export async function nasdaqQuote(f: FetchLike, symbol: string): Promise<QuoteResult & { assetClass: string }> {
  for (const assetClass of CLASSES) {
    const json = (await getJson(f, `${API}/quote/${encodeURIComponent(symbol)}/info?assetclass=${assetClass}`).catch(() => null)) as InfoResponse | null;
    const d = json?.data;
    const price = num(d?.primaryData?.lastSalePrice);
    if (!d || !Number.isFinite(price)) continue;
    return {
      source: "nasdaq",
      symbol: (d.symbol ?? symbol).toUpperCase(),
      name: (d.companyName ?? symbol).replace(/ Common Stock$/, ""),
      price,
      currency: "USD",
      change: num(d.primaryData?.netChange) || 0,
      changePct: num(d.primaryData?.percentageChange) || 0,
      asOf: new Date().toISOString(),
      assetClass,
    };
  }
  throw new MarketError(404, `Nasdaq does not know ${symbol}`);
}

type HistoryResponse = { data?: { tradesTable?: { rows?: { date?: string; close?: string }[] } } | null };

export async function nasdaqHistory(f: FetchLike, symbol: string, from: string, to: string): Promise<HistoryPoint[]> {
  for (const assetClass of CLASSES) {
    const json = (await getJson(f, `${API}/quote/${encodeURIComponent(symbol)}/historical?assetclass=${assetClass}&fromdate=${from}&todate=${to}&limit=9999`).catch(() => null)) as HistoryResponse | null;
    const rows = json?.data?.tradesTable?.rows;
    if (!rows?.length) continue;
    return parseNasdaqHistory(rows);
  }
  throw new MarketError(404, `No Nasdaq history for ${symbol}`);
}

export function parseNasdaqHistory(rows: { date?: string; close?: string }[]): HistoryPoint[] {
  return rows
    .map((r): HistoryPoint | null => {
      const date = usDate(r.date);
      const close = num(r.close);
      return date && Number.isFinite(close) ? [date, close] : null;
    })
    .filter((p): p is HistoryPoint => p !== null)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

type EarningsResponse = { data?: { reportText?: string } | null };
type DividendsResponse = { data?: { exDividendDate?: string; dividendPaymentDate?: string; annualizedDividend?: string; dividends?: { rows?: { exOrEffDate?: string; paymentDate?: string; amount?: string }[] | null } } | null };

export async function nasdaqEvents(f: FetchLike, symbol: string, assetClass = "stocks"): Promise<MarketEvent[]> {
  const out: MarketEvent[] = [];
  const [earnings, dividends] = await Promise.all([
    getJson(f, `${API}/analyst/${encodeURIComponent(symbol)}/earnings-date`).catch(() => null) as Promise<EarningsResponse | null>,
    getJson(f, `${API}/quote/${encodeURIComponent(symbol)}/dividends?assetclass=${assetClass}`).catch(() => null) as Promise<DividendsResponse | null>,
  ]);
  const text = earnings?.data?.reportText ?? "";
  const date = usDate(text);
  if (date) out.push({ date, kind: "earnings", title: "Presentación de resultados", amount: null, estimated: /estimated|algorithm/i.test(text) });
  const d = dividends?.data;
  const rows = d?.dividends?.rows ?? [];
  const last = rows[0];
  const amount = last ? num(last.amount) : NaN;
  const ex = usDate(d?.exDividendDate);
  const pay = usDate(d?.dividendPaymentDate);
  if (ex) out.push({ date: ex, kind: "ex_dividend", title: "Fecha ex-dividendo", amount: Number.isFinite(amount) ? amount : null, estimated: false });
  if (pay) out.push({ date: pay, kind: "dividend_payment", title: "Pago de dividendo", amount: Number.isFinite(amount) ? amount : null, estimated: false });
  // Recent dividend history (useful for the calendar of past payments).
  for (const r of rows.slice(1, 8)) {
    const p = usDate(r.paymentDate);
    const a = num(r.amount);
    if (p) out.push({ date: p, kind: "dividend_payment", title: "Pago de dividendo", amount: Number.isFinite(a) ? a : null, estimated: false });
  }
  return out;
}

type LookupResponse = { data?: { symbol?: string; name?: string; asset?: string; exchange?: string }[] | null };

export async function nasdaqSearch(f: FetchLike, query: string): Promise<SearchResult[]> {
  const json = (await getJson(f, `${API}/autocomplete/slookup/10?search=${encodeURIComponent(query)}`)) as LookupResponse;
  return (json.data ?? [])
    .filter((r) => r.symbol && r.name)
    .map((r) => ({
      source: "nasdaq" as const,
      id: r.symbol!,
      symbol: r.symbol!,
      name: r.name!,
      assetType: (r.asset?.toUpperCase() === "ETF" ? "etf" : "stock") as AssetType,
      exchange: r.exchange ?? "",
    }));
}
