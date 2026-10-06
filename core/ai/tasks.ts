import { z } from "zod";
import { ASSET_TYPES } from "../domain/finance";
import { analysisSchema, type MarketEvent, type NewsItem, type SocialPost } from "../domain/market";
import { extractJson } from "./json";
import type { AIGateway } from "./gateway";
import type { GroundedSearch } from "./grounded";
import type { ChatMessage } from "./types";

// Every AI task: a prompt + a zod schema, always through gateway.chatJSON (repairs and retries bad JSON).
// Schemas are lenient on purpose (free models are sloppy); strict validation happens when saving.

const numberish = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return v;
  const s = v.replace(/[€$%\s]/g, "");
  const normalized = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  return Number(normalized);
}, z.number().finite());

const looseDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((s) => s.slice(0, 10));

// ---- Bank statements / receipts -> transactions --------------------------------------------
export const aiTransactionSchema = z.object({
  date: looseDate,
  amount: numberish.transform(Math.abs),
  kind: z.enum(["expense", "income", "transfer"]).catch("expense"),
  description: z.string().default(""),
  merchant: z.string().nullish().transform((v) => v ?? ""),
  category: z.string().nullish(),
  account: z.string().nullish(),
  currency: z.string().nullish(),
});
export type AiTransaction = z.infer<typeof aiTransactionSchema>;

const statementSchema = z.object({
  transactions: z.array(z.unknown()).default([]),
  closingBalance: numberish.nullish(),
  accountHint: z.string().nullish(),
});

export interface StatementContext {
  today: string;
  currency: string;
  categories: string[];
  accounts: string[];
}

function statementMessages(text: string, ctx: StatementContext): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You extract money movements from bank statements, card statements, receipts or pasted notes for a personal-finance app. Today is ${ctx.today}. Default currency ${ctx.currency}.
Return ONLY JSON: {"transactions":[{"date":"YYYY-MM-DD","amount":number (always positive),"kind":"expense"|"income"|"transfer","description":string,"merchant":string,"category":string|null,"account":string|null,"currency":string|null}],"closingBalance":number|null,"accountHint":string|null}
Rules: one item per movement; negative/charge/cargo = expense, abono/ingreso/nómina = income, traspaso between own accounts = transfer. Dates in dd/mm/yyyy are European. If the year is missing use the most recent past date. "merchant" is the clean shop/company name (e.g. "Mercadona"). "category" must be one of: ${ctx.categories.join(", ")} (or null). "account" one of: ${ctx.accounts.join(", ") || "(none)"} (or null). closingBalance = final balance shown in the statement, if any. Ignore balance-only lines and headers. Never invent movements.`,
    },
    { role: "user", content: text },
  ];
}

// Large statements are split so free models with short outputs do not truncate the list.
export function chunkText(text: string, size = 9000): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length > size && current) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export async function extractTransactions(gateway: AIGateway, text: string, ctx: StatementContext, opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}) {
  const chunks = chunkText(text);
  const transactions: AiTransaction[] = [];
  let closingBalance: number | null = null;
  let accountHint: string | null = null;
  let dropped = 0;
  for (let i = 0; i < chunks.length; i++) {
    opts.onProgress?.(i, chunks.length);
    const { data } = await gateway.chatJSON({ messages: statementMessages(chunks[i], ctx), temperature: 0, maxTokens: 6000, signal: opts.signal }, statementSchema);
    for (const raw of data.transactions) {
      const parsed = aiTransactionSchema.safeParse(raw);
      if (parsed.success && parsed.data.amount > 0) transactions.push(parsed.data);
      else dropped++;
    }
    closingBalance = data.closingBalance ?? closingBalance;
    accountHint = data.accountHint ?? accountHint;
  }
  opts.onProgress?.(chunks.length, chunks.length);
  return { transactions, closingBalance, accountHint, dropped };
}

// ---- Payslip ---------------------------------------------------------------------------------
export const payslipSchema = z.object({
  period: z.string().nullish(),
  company: z.string().nullish(),
  grossMonthly: numberish.nullish(),
  netMonthly: numberish.nullish(),
  irpfRate: numberish.nullish(),
  ssAmount: numberish.nullish(),
  grossAnnual: numberish.nullish(),
  payments: numberish.nullish(),
  proratedExtras: z.boolean().nullish(),
});
export type Payslip = z.infer<typeof payslipSchema>;

export async function extractPayslip(gateway: AIGateway, text: string, signal?: AbortSignal): Promise<Payslip> {
  const { data } = await gateway.chatJSON(
    {
      messages: [
        {
          role: "system",
          content: `You read Spanish payslips (nóminas). Return ONLY JSON: {"period":string|null,"company":string|null,"grossMonthly":number|null (total devengado),"netMonthly":number|null (líquido a percibir),"irpfRate":number|null (% retención IRPF),"ssAmount":number|null (total aportaciones del trabajador a la Seguridad Social),"grossAnnual":number|null (only if printed or clearly derivable),"payments":12|14|null,"proratedExtras":boolean|null (true if "prorrata pagas extra" appears)}. Numbers without currency symbols.`,
        },
        { role: "user", content: text.slice(0, 20000) },
      ],
      temperature: 0,
      maxTokens: 800,
      signal,
    },
    payslipSchema,
  );
  return data;
}

// ---- Broker report -> holdings ---------------------------------------------------------------
export const aiHoldingSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().nullish().transform((v) => v ?? ""),
  isin: z.string().nullish().transform((v) => v ?? ""),
  assetType: z.enum(ASSET_TYPES).catch("other"),
  units: numberish.nullish(),
  avgCost: numberish.nullish(),
  value: numberish.nullish(),
  invested: numberish.nullish(),
  weightPct: numberish.nullish(),
  currency: z.string().nullish(),
});
export type AiHolding = z.infer<typeof aiHoldingSchema>;

export async function extractHoldings(gateway: AIGateway, text: string, signal?: AbortSignal): Promise<AiHolding[]> {
  const { data } = await gateway.chatJSON(
    {
      messages: [
        {
          role: "system",
          content: `You read broker/robo-advisor reports or the user's own description of their portfolio (index funds, ETFs, stocks, crypto, pension plans). Return ONLY JSON: {"holdings":[{"name":string,"symbol":string|null (exchange ticker, Yahoo style for European listings e.g. "VWCE.DE", "IWDA.AS"; crypto symbol e.g. "BTC"),"isin":string|null,"assetType":${ASSET_TYPES.map((t) => `"${t}"`).join("|")},"units":number|null,"avgCost":number|null (per unit),"value":number|null (current market value),"invested":number|null (total cost),"weightPct":number|null (share of the portfolio 0-100),"currency":string|null}]}. Include only positions actually present. If the user gives only percentages, fill weightPct.`,
        },
        { role: "user", content: text.slice(0, 24000) },
      ],
      temperature: 0,
      maxTokens: 3000,
      signal,
    },
    z.object({ holdings: z.array(z.unknown()).default([]) }),
  );
  return data.holdings.map((h) => aiHoldingSchema.safeParse(h)).filter((r) => r.success).map((r) => r.data!);
}

// ---- Holding analysis (news, social, events -> impacts and scenarios) -----------------------
export interface AnalysisInput {
  today: string;
  holding: { name: string; symbol: string; isin: string; assetType: string; currency: string };
  position: { value: number; weight: number; pnlPct: number | null } | null;
  price: { last: number | null; change1m: number | null; change1y: number | null; high52: number | null; low52: number | null } | null;
  news: NewsItem[];
  social: SocialPost[];
  events: MarketEvent[];
}

const analysisOutput = analysisSchema.pick({ summary: true, sentiment: true, pastDrivers: true, upcoming: true, risks: true, scenarios: true, horizon: true });
export type AnalysisOutput = z.infer<typeof analysisOutput>;

const ANALYSIS_GUIDE = `You are an equity/ETF/crypto research assistant inside a personal-finance app for a Spanish retail investor. Write in Spanish. Be factual, cite dates, and separate facts from opinion. This is NOT investment advice: never tell the user to buy or sell; describe scenarios.
Return ONLY JSON:
{"summary":string (4-6 sentences: what the asset is, what moved its price recently and why, what the market is watching),
 "sentiment":"bullish"|"bearish"|"neutral"|"mixed",
 "pastDrivers":[{"title":string,"detail":string,"impact":"positive"|"negative"|"neutral","date":"YYYY-MM-DD"|null}] (3-6 events that already affected the price),
 "upcoming":[{"title":string,"detail":string,"impact":"positive"|"negative"|"neutral","date":"YYYY-MM-DD"|null}] (2-6 known or likely future catalysts: earnings, central-bank meetings, product launches, regulation, index rebalances, macro data),
 "risks":[string] (3-5),
 "scenarios":[{"label":"Alcista"|"Base"|"Bajista","probability":number 0-100,"changePct":number (expected % price change over the horizon),"thesis":string}] (exactly 3, probabilities sum 100),
 "horizon":string (e.g. "12 meses")}`;

function analysisContext(input: AnalysisInput): string {
  const h = input.holding;
  const lines = [
    `Today: ${input.today}`,
    `Asset: ${h.name} (${h.symbol || "no ticker"}${h.isin ? `, ISIN ${h.isin}` : ""}), type ${h.assetType}, currency ${h.currency}.`,
  ];
  if (input.price) lines.push(`Price: last ${input.price.last ?? "?"}; 1-month change ${fmt(input.price.change1m)}%; 1-year change ${fmt(input.price.change1y)}%; 52w range ${input.price.low52 ?? "?"}-${input.price.high52 ?? "?"}.`);
  if (input.position) lines.push(`User position: ${input.position.weight.toFixed(1)}% of portfolio, P/L ${fmt(input.position.pnlPct)}%.`);
  if (input.events.length) lines.push(`Corporate calendar:\n${input.events.map((e) => `- ${e.date} ${e.kind}${e.amount != null ? ` ${e.amount}` : ""}${e.estimated ? " (estimated)" : ""}`).join("\n")}`);
  if (input.news.length) lines.push(`Recent headlines (newest first):\n${input.news.slice(0, 25).map((n) => `- [${n.publishedAt.slice(0, 10)}] ${n.title} (${n.source})`).join("\n")}`);
  if (input.social.length) lines.push(`Social posts (Bluesky):\n${input.social.slice(0, 12).map((p) => `- @${p.handle}: ${p.text.replace(/\s+/g, " ").slice(0, 220)}`).join("\n")}`);
  return lines.join("\n\n");
}

const fmt = (n: number | null | undefined) => (n == null ? "?" : n.toFixed(1));

export async function analyzeHolding(deps: { gateway: AIGateway; grounded?: GroundedSearch }, input: AnalysisInput, signal?: AbortSignal): Promise<{ data: AnalysisOutput; sources: { title: string; url: string }[]; grounded: boolean; provider: string }> {
  const context = analysisContext(input);
  if (deps.grounded?.available()) {
    try {
      const r = await deps.grounded.search(
        [
          { role: "system", content: `${ANALYSIS_GUIDE}\nUse Google Search to verify the latest news (last 30 days), upcoming earnings/dividend dates, analyst targets and what is being discussed on social media (X/Twitter, Reddit). Prefer primary sources.` },
          { role: "user", content: context },
        ],
        signal,
      );
      const parsed = analysisOutput.safeParse(extractJson(r.content));
      if (parsed.success) return { data: parsed.data, sources: r.sources.slice(0, 12), grounded: true, provider: r.provider };
    } catch {
      // Quota or network: fall through to the plain model with our own headlines.
    }
  }
  const { data, provider } = await deps.gateway.chatJSON({ messages: [{ role: "system", content: ANALYSIS_GUIDE }, { role: "user", content: context }], temperature: 0.3, maxTokens: 2500, signal }, analysisOutput);
  return { data, sources: input.news.slice(0, 8).map((n) => ({ title: n.title, url: n.url })), grounded: false, provider };
}

// ---- Portfolio brief -------------------------------------------------------------------------
export const briefSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  diversification: z.string().default(""),
  watch: z.array(z.object({ date: z.string().nullish(), title: z.string() })).default([]),
});
export type PortfolioBrief = z.infer<typeof briefSchema>;

export async function portfolioBrief(deps: { gateway: AIGateway; grounded?: GroundedSearch }, input: { today: string; positions: string; headlines: string }, signal?: AbortSignal): Promise<{ data: PortfolioBrief; sources: { title: string; url: string }[] }> {
  const guide = `You review a retail investor's portfolio for a personal-finance app. Spanish. Educational, not advice (never "buy"/"sell"). Return ONLY JSON: {"summary":string (what happened to the portfolio and markets recently, 4-6 sentences),"highlights":[string] (3-6 notable moves/news per holding),"risks":[string] (concentration, currency, sector, overlap between funds),"diversification":string (2-3 sentences on regions/sectors/asset classes),"watch":[{"date":"YYYY-MM-DD"|null,"title":string}] (upcoming events that can move these holdings)}.`;
  const user = `Today ${input.today}.\nPositions:\n${input.positions}\n\nHeadlines:\n${input.headlines}`;
  if (deps.grounded?.available()) {
    try {
      const r = await deps.grounded.search([{ role: "system", content: `${guide}\nUse Google Search for the latest market news and upcoming events.` }, { role: "user", content: user }], signal);
      const parsed = briefSchema.safeParse(extractJson(r.content));
      if (parsed.success) return { data: parsed.data, sources: r.sources.slice(0, 10) };
    } catch {
      // fall back below
    }
  }
  const { data } = await deps.gateway.chatJSON({ messages: [{ role: "system", content: guide }, { role: "user", content: user }], temperature: 0.3, maxTokens: 2000, signal }, briefSchema);
  return { data, sources: [] };
}

// ---- Spending review -------------------------------------------------------------------------
export const reviewSchema = z.object({
  summary: z.string(),
  insights: z.array(z.string()).default([]),
  tips: z.array(z.object({ title: z.string(), detail: z.string().default(""), monthlySaving: numberish.nullish() })).default([]),
});
export type SpendingReview = z.infer<typeof reviewSchema>;

export async function reviewSpending(gateway: AIGateway, context: string, signal?: AbortSignal): Promise<SpendingReview> {
  const { data } = await gateway.chatJSON(
    {
      messages: [
        { role: "system", content: `You are a frugal, practical personal-finance coach for a Spanish user. Spanish, friendly, concrete numbers from the data. Return ONLY JSON: {"summary":string (3-5 sentences),"insights":[string] (4-6 observations: trends, unusual categories, subscriptions, savings rate),"tips":[{"title":string,"detail":string,"monthlySaving":number|null}] (3-5 specific actions with estimated monthly saving)}. Do not recommend specific financial products.` },
        { role: "user", content: context },
      ],
      temperature: 0.4,
      maxTokens: 1800,
      signal,
    },
    reviewSchema,
  );
  return data;
}

// ---- Price lookup for funds without a public quote (needs web search) -----------------------
export const navSchema = z.object({ price: numberish.nullish(), currency: z.string().nullish(), date: z.string().nullish(), name: z.string().nullish() });

export async function lookupNav(grounded: GroundedSearch, query: { name: string; isin: string; symbol: string }, signal?: AbortSignal) {
  const r = await grounded.search(
    [
      { role: "system", content: `Find the latest published price / net asset value (valor liquidativo) of the fund or security. Return ONLY JSON {"price":number|null,"currency":string|null,"date":"YYYY-MM-DD"|null,"name":string|null}. Use null when unsure; never guess.` },
      { role: "user", content: `${query.name} ${query.isin ? `ISIN ${query.isin}` : ""} ${query.symbol}`.trim() },
    ],
    signal,
  );
  const parsed = navSchema.safeParse(extractJson(r.content));
  return { ...(parsed.success ? parsed.data : { price: null, currency: null, date: null, name: null }), sources: r.sources };
}
