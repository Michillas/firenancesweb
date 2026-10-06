import { z } from "zod";
import { entityShape } from "./base";

// Cached market data. Rows are keyed by "<source>:<id>" so two holdings of the same ticker share one quote.
export const quoteSchema = z.object({
  ...entityShape,
  source: z.string(),
  symbol: z.string(),
  name: z.string().default(""),
  price: z.number(),
  currency: z.string().default("USD"),
  change: z.number().default(0),
  changePct: z.number().default(0),
  asOf: z.string(),
  // Daily closes for charts: [YYYY-MM-DD, close].
  history: z.array(z.tuple([z.string(), z.number()])).default([]),
  historyAt: z.string().nullable().default(null),
  // Direction of the last price change (drives the green/red flash) and whether it came from a live feed.
  tick: z.enum(["up", "down"]).nullable().default(null),
  live: z.boolean().default(false),
});
export type Quote = z.infer<typeof quoteSchema>;

export const newsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string().default(""),
  publishedAt: z.string().default(""),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

export const socialPostSchema = z.object({
  author: z.string(),
  handle: z.string().default(""),
  text: z.string(),
  url: z.string().default(""),
  publishedAt: z.string().default(""),
  likes: z.number().default(0),
  network: z.string().default("bluesky"),
});
export type SocialPost = z.infer<typeof socialPostSchema>;

export const marketEventSchema = z.object({
  date: z.string(),
  kind: z.enum(["earnings", "ex_dividend", "dividend_payment", "split", "other"]),
  title: z.string(),
  amount: z.number().nullable().default(null),
  estimated: z.boolean().default(false),
});
export type MarketEvent = z.infer<typeof marketEventSchema>;

// News, social posts and upcoming corporate events per holding (id = holding id).
export const feedSchema = z.object({
  ...entityShape,
  holdingId: z.string(),
  news: z.array(newsItemSchema).default([]),
  social: z.array(socialPostSchema).default([]),
  events: z.array(marketEventSchema).default([]),
  fetchedAt: z.string().nullable().default(null),
});
export type Feed = z.infer<typeof feedSchema>;

export const scenarioSchema = z.object({
  label: z.string(),
  probability: z.number().min(0).max(100).nullable().default(null),
  // Expected change over the horizon, in percent.
  changePct: z.number().nullable().default(null),
  thesis: z.string(),
});

export const factorSchema = z.object({
  title: z.string(),
  detail: z.string().default(""),
  impact: z.enum(["positive", "negative", "neutral"]).default("neutral"),
  date: z.string().nullable().default(null),
});

// AI analysis of one holding (or the whole portfolio when holdingId = "portfolio").
export const analysisSchema = z.object({
  ...entityShape,
  holdingId: z.string(),
  summary: z.string(),
  sentiment: z.enum(["bullish", "bearish", "neutral", "mixed"]).default("neutral"),
  pastDrivers: z.array(factorSchema).default([]),
  upcoming: z.array(factorSchema).default([]),
  risks: z.array(z.string()).default([]),
  scenarios: z.array(scenarioSchema).default([]),
  horizon: z.string().default("12 meses"),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  grounded: z.boolean().default(false),
  provider: z.string().default(""),
});
export type Analysis = z.infer<typeof analysisSchema>;

// FX rates against the base currency (1 base = rate * other). Single row, id = base currency.
export const fxSchema = z.object({
  ...entityShape,
  base: z.string(),
  rates: z.record(z.string(), z.number()).default({}),
  date: z.string().default(""),
});
export type FxRates = z.infer<typeof fxSchema>;
