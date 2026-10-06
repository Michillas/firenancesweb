import { analyzeHolding, extractHoldings, extractPayslip, extractTransactions, lookupNav, portfolioBrief, reviewSpending, type AiHolding } from "@/core/ai";
import type { Holding } from "@/core/domain/finance";
import { addMonthKey, lastMonths, monthOf, todayKey, firstDay, lastDay } from "@/core/logic/dates";
import { budgetStatus, monthlySummary, spendingByCategory, topMerchants } from "@/core/logic/cashflow";
import { holdingQuoteKey, resolveSource } from "@/core/logic/networth";
import { positions, totals } from "@/core/logic/portfolio";
import { recurringMonthlyTotal } from "@/core/logic/forecast";
import { formatMoney } from "@/lib/format";
import { gateway, grounded } from "../ai";
import { refreshFeed, refreshHistory } from "../market";
import { accounts, analyses, categories, feeds, fxRates, holdings, quotes, recurring, settings, transactions } from "../stores";
import type { ImportDraft } from "./finance";

const fx = () => fxRates.get(settings.get().currency) ?? null;
const quoteMap = () => new Map(quotes.list().map((q) => [q.id, q]));

export async function aiExtractTransactions(text: string, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<{ drafts: ImportDraft[]; closingBalance: number | null; dropped: number }> {
  const cats = categories.list().filter((c) => !c.archived);
  const r = await extractTransactions(
    gateway,
    text,
    { today: todayKey(), currency: settings.get().currency, categories: cats.map((c) => c.name), accounts: accounts.list().map((a) => a.name) },
    { onProgress, signal },
  );
  return {
    drafts: r.transactions.map((t) => ({ date: t.date, amount: t.amount, kind: t.kind, description: t.description, merchant: t.merchant, category: t.category ?? null, account: t.account ?? null, currency: t.currency ?? null })),
    closingBalance: r.closingBalance,
    dropped: r.dropped,
  };
}

export const aiExtractPayslip = (text: string, signal?: AbortSignal) => extractPayslip(gateway, text, signal);
export const aiExtractHoldings = (text: string, signal?: AbortSignal): Promise<AiHolding[]> => extractHoldings(gateway, text, signal);

function priceStats(history: [string, number][]) {
  if (history.length < 2) return null;
  const last = history[history.length - 1][1];
  const at = (days: number) => {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const point = history.find((p) => p[0] >= cutoff);
    return point ? ((last - point[1]) / point[1]) * 100 : null;
  };
  const closes = history.map((p) => p[1]);
  return { last, change1m: at(30), change1y: at(365), high52: Math.max(...closes), low52: Math.min(...closes) };
}

export async function analyzeHoldingAction(h: Holding, signal?: AbortSignal) {
  await refreshFeed(h).catch(() => undefined);
  const key = holdingQuoteKey(h);
  if (key) await refreshHistory(h).catch(() => undefined);
  const feed = feeds.get(h.id);
  const quote = key ? quotes.get(key) : undefined;
  const rows = positions(holdings.list(), quoteMap(), fx());
  const pos = rows.find((r) => r.holding.id === h.id);
  const result = await analyzeHolding(
    { gateway, grounded },
    {
      today: todayKey(),
      holding: { name: h.name, symbol: h.symbol, isin: h.isin, assetType: h.assetType, currency: h.currency },
      position: pos ? { value: pos.valueBase, weight: pos.weight, pnlPct: pos.pnlPct } : null,
      price: quote ? priceStats(quote.history) ?? { last: quote.price, change1m: null, change1y: null, high52: null, low52: null } : null,
      news: feed?.news ?? [],
      social: feed?.social ?? [],
      events: feed?.events ?? [],
    },
    signal,
  );
  return analyses.upsert(`an_${h.id}`, { holdingId: h.id, ...result.data, sources: result.sources, grounded: result.grounded, provider: result.provider });
}

export async function portfolioBriefAction(signal?: AbortSignal) {
  const rows = positions(holdings.list(), quoteMap(), fx());
  const base = settings.get().currency;
  const t = totals(rows);
  const lines = rows.map((r) => `- ${r.holding.name} (${r.holding.symbol || r.holding.isin || r.holding.assetType}): ${r.weight.toFixed(1)}% · ${formatMoney(r.valueBase, { currency: base })} · P/L ${r.pnlPct == null ? "?" : r.pnlPct.toFixed(1)}% · día ${r.quote ? r.quote.changePct.toFixed(2) : "?"}%`);
  lines.push(`Total ${formatMoney(t.value, { currency: base })}, coste ${formatMoney(t.cost, { currency: base })}.`);
  const headlines = rows
    .flatMap((r) => (feeds.get(r.holding.id)?.news ?? []).slice(0, 5).map((n) => `- [${r.holding.name}] ${n.publishedAt.slice(0, 10)} ${n.title}`))
    .slice(0, 40)
    .join("\n");
  const r = await portfolioBrief({ gateway, grounded }, { today: todayKey(), positions: lines.join("\n"), headlines: headlines || "(none fetched)" }, signal);
  return analyses.upsert("an_portfolio", {
    holdingId: "portfolio",
    summary: [r.data.summary, r.data.diversification].filter(Boolean).join("\n\n"),
    sentiment: "neutral",
    pastDrivers: r.data.highlights.map((x) => ({ title: x, detail: "", impact: "neutral" as const, date: null })),
    upcoming: r.data.watch.map((w) => ({ title: w.title, detail: "", impact: "neutral" as const, date: w.date ?? null })),
    risks: r.data.risks,
    scenarios: [],
    horizon: "",
    sources: r.sources,
    grounded: r.sources.length > 0,
    provider: "",
  });
}

export async function reviewSpendingAction(signal?: AbortSignal) {
  const today = todayKey();
  const base = settings.get().currency;
  const money = (n: number) => formatMoney(n, { currency: base });
  const catMap = new Map(categories.list().map((c) => [c.id, c]));
  const txs = transactions.list();
  const months = lastMonths(monthOf(today), 6);
  const summary = monthlySummary(txs, months, catMap, fx());
  const from = firstDay(addMonthKey(monthOf(today), -3));
  const byCat = spendingByCategory(txs, from, lastDay(addMonthKey(monthOf(today), -1)), fx());
  const merchants = topMerchants(txs, from, today, fx(), 10);
  const budgets = budgetStatus(categories.list(), txs, monthOf(today), today, fx());
  const context = [
    `Today ${today}. Currency ${base}.`,
    `Last 6 months (income / spending / saved-invested / savings rate):\n${summary.map((s) => `- ${s.month}: ${money(s.income)} / ${money(s.expense)} / ${money(s.saved)} / ${s.savingsRate == null ? "?" : s.savingsRate.toFixed(0)}%`).join("\n")}`,
    `Spending by category, last 3 complete months:\n${byCat.map((c) => `- ${c.categoryId ? catMap.get(c.categoryId)?.name ?? "?" : "Sin categoría"}: ${money(c.total)} (${c.count} movimientos)`).join("\n")}`,
    `Top merchants (3 months):\n${merchants.map((m) => `- ${m.name}: ${money(m.total)} (${m.count})`).join("\n")}`,
    `Recurring charges: ${money(recurringMonthlyTotal(recurring.list(), fx()))}/month across ${recurring.list().filter((r) => r.active && r.kind !== "income").length} items: ${recurring.list().filter((r) => r.active && r.kind !== "income").map((r) => `${r.name} ${money(r.amount)}/${r.cycle}`).join(", ")}`,
    budgets.length ? `Budgets this month:\n${budgets.map((b) => `- ${b.category.name}: ${money(b.spent)} of ${money(b.budget)}`).join("\n")}` : "No budgets set.",
  ].join("\n\n");
  return reviewSpending(gateway, context, signal);
}

export async function lookupPriceAction(h: Holding, signal?: AbortSignal) {
  if (!grounded.available()) throw new Error("no-grounding");
  return lookupNav(grounded, { name: h.name, isin: h.isin, symbol: h.symbol }, signal);
}

export const canSearchWeb = () => grounded.available();
export { resolveSource };
