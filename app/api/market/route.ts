import { z } from "zod";
import { MarketError } from "@/core/market/types";
import { clientId, rateLimit } from "@/lib/server-ai";
import { cached, market } from "@/lib/server-market";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MIN = 60_000;
const source = z.enum(["yahoo", "nasdaq", "coingecko", "justetf", "ft", "ftstock"]);
const isin = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/).optional();
const id = z.string().trim().min(1).max(80);
const text = z.string().trim().min(1).max(160);
const currency = z.string().regex(/^[A-Z]{3}$/).default("EUR");

const ops = {
  quote: { schema: z.object({ source, id, vs: currency, isin }), ttl: 5 * MIN, run: (q: { source: z.infer<typeof source>; id: string; vs: string; isin?: string }) => market.quote(q.source, q.id, q.vs, q.isin) },
  // Same as quote, near real time: used by the live poller during market hours.
  live: { schema: z.object({ source, id, vs: currency, isin }), ttl: 8_000, run: (q: { source: z.infer<typeof source>; id: string; vs: string; isin?: string }) => market.quote(q.source, q.id, q.vs, q.isin) },
  history: { schema: z.object({ source, id, vs: currency, isin, range: z.enum(["1mo", "6mo", "1y", "5y"]).default("1y") }), ttl: 60 * MIN, run: (q: { source: z.infer<typeof source>; id: string; vs: string; range: string; isin?: string }) => market.history(q.source, q.id, q.range, q.vs, q.isin) },
  events: { schema: z.object({ source, id }), ttl: 6 * 60 * MIN, run: (q: { source: z.infer<typeof source>; id: string }) => market.events(q.source, q.id) },
  search: { schema: z.object({ q: text }), ttl: 60 * MIN, run: (q: { q: string }) => market.search(q.q) },
  news: { schema: z.object({ q: text, symbol: z.string().max(40).optional() }), ttl: 30 * MIN, run: (q: { q: string; symbol?: string }) => market.news(q.q, q.symbol) },
  social: { schema: z.object({ q: text }), ttl: 30 * MIN, run: (q: { q: string }) => market.social(q.q) },
  fx: { schema: z.object({ base: currency }), ttl: 6 * 60 * MIN, run: (q: { base: string }) => market.fx(q.base) },
} as const;

type Op = keyof typeof ops;

// Thin server proxy for public market data (most providers block browser origins or need headers).
export async function GET(request: Request) {
  if (!rateLimit(`m:${clientId(request)}`, 400)) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "retry-after": "30" } });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const op = params.op as Op;
  const def = ops[op];
  if (!def) return Response.json({ error: "unknown-op" }, { status: 400 });
  const parsed = def.schema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "bad-request" }, { status: 400 });
  try {
    const key = `${op}:${JSON.stringify(parsed.data)}`;
    const data = await cached(key, def.ttl, () => (def.run as (q: unknown) => Promise<unknown>)(parsed.data));
    return Response.json({ data }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (error) {
    const status = error instanceof MarketError ? (error.status === 404 ? 404 : 502) : 502;
    return Response.json({ error: error instanceof Error ? error.message : "market-error" }, { status });
  }
}
