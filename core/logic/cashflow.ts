import type { Category, Transaction } from "../domain/finance";
import { addMonthKey, daysInMonth, firstDay, lastDay, lastMonths, monthOf, type DayKey, type MonthKey } from "./dates";
import { toBase, type FxTable } from "./money";

// Transactions that count for statistics: no transfers, nothing the user excluded.
export const countable = (tx: Transaction) => !tx.excluded && !tx.deletedAt && tx.kind !== "transfer";

export interface MonthSummary {
  month: MonthKey;
  income: number;
  expense: number;
  // Expenses in "savings" categories (contributions to a broker, pension plan...): money kept, not spent.
  saved: number;
  net: number;
  savingsRate: number | null;
}

export function monthlySummary(txs: readonly Transaction[], months: readonly MonthKey[], categories: ReadonlyMap<string, Category>, fx: FxTable | null): MonthSummary[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const rows = months.map((month) => ({ month, income: 0, expense: 0, saved: 0 }));
  for (const tx of txs) {
    if (!countable(tx)) continue;
    const i = index.get(monthOf(tx.date));
    if (i === undefined) continue;
    const amount = toBase(tx.amount, tx.currency, fx);
    if (tx.kind === "income") rows[i].income += amount;
    else if (tx.categoryId && categories.get(tx.categoryId)?.group === "savings") rows[i].saved += amount;
    else rows[i].expense += amount;
  }
  return rows.map((r) => ({
    ...r,
    net: r.income - r.expense - r.saved,
    savingsRate: r.income > 0 ? ((r.income - r.expense) / r.income) * 100 : null,
  }));
}

export function inRange(tx: Transaction, from: DayKey, to: DayKey) {
  return tx.date >= from && tx.date <= to;
}

export interface CategoryTotal {
  categoryId: string | null;
  total: number;
  count: number;
}

export function spendingByCategory(txs: readonly Transaction[], from: DayKey, to: DayKey, fx: FxTable | null, kind: "expense" | "income" = "expense"): CategoryTotal[] {
  const map = new Map<string | null, CategoryTotal>();
  for (const tx of txs) {
    if (!countable(tx) || tx.kind !== kind || !inRange(tx, from, to)) continue;
    const row = map.get(tx.categoryId) ?? { categoryId: tx.categoryId, total: 0, count: 0 };
    row.total += toBase(tx.amount, tx.currency, fx);
    row.count += 1;
    map.set(tx.categoryId, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// month -> categoryId -> total; the data behind the stacked monthly chart.
export function categoryByMonth(txs: readonly Transaction[], months: readonly MonthKey[], fx: FxTable | null): Map<MonthKey, Map<string, number>> {
  const out = new Map(months.map((m) => [m, new Map<string, number>()]));
  for (const tx of txs) {
    if (!countable(tx) || tx.kind !== "expense") continue;
    const bucket = out.get(monthOf(tx.date));
    if (!bucket) continue;
    const key = tx.categoryId ?? "none";
    bucket.set(key, (bucket.get(key) ?? 0) + toBase(tx.amount, tx.currency, fx));
  }
  return out;
}

export const normalizeMerchant = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(compra|pago|tarj(eta)?|recibo|transferencia|bizum|en|con|s\.?l\.?|s\.?a\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\d{4,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function topMerchants(txs: readonly Transaction[], from: DayKey, to: DayKey, fx: FxTable | null, limit = 8): { name: string; total: number; count: number }[] {
  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const tx of txs) {
    if (!countable(tx) || tx.kind !== "expense" || !inRange(tx, from, to)) continue;
    const label = (tx.merchant || tx.description).trim();
    const key = normalizeMerchant(label) || label.toLowerCase();
    if (!key) continue;
    const row = map.get(key) ?? { name: label, total: 0, count: 0 };
    row.total += toBase(tx.amount, tx.currency, fx);
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

// Average monthly spend per category over the `n` complete months before `month`.
export function averageByCategory(txs: readonly Transaction[], month: MonthKey, n: number, fx: FxTable | null, opts: { skipRecurring?: boolean } = {}): Map<string, number> {
  const months = lastMonths(addMonthKey(month, -1), n);
  const from = firstDay(months[0]);
  const to = lastDay(months[months.length - 1]);
  // Only average over months that actually have data, so a new user is not diluted by empty months.
  const active = new Set<string>();
  const totals = new Map<string, number>();
  for (const tx of txs) {
    if (!countable(tx) || tx.kind !== "expense" || !inRange(tx, from, to)) continue;
    active.add(monthOf(tx.date));
    if (opts.skipRecurring && tx.recurringId) continue;
    const key = tx.categoryId ?? "none";
    totals.set(key, (totals.get(key) ?? 0) + toBase(tx.amount, tx.currency, fx));
  }
  const divisor = Math.max(1, active.size);
  return new Map([...totals.entries()].map(([k, v]) => [k, v / divisor]));
}

export interface BudgetRow {
  category: Category;
  budget: number;
  spent: number;
  // Linear projection to month end.
  projected: number;
  pct: number;
  status: "ok" | "warning" | "over";
}

export function budgetStatus(categories: readonly Category[], txs: readonly Transaction[], month: MonthKey, today: DayKey, fx: FxTable | null): BudgetRow[] {
  const spent = new Map(spendingByCategory(txs, firstDay(month), lastDay(month), fx).map((r) => [r.categoryId, r.total]));
  const days = daysInMonth(month);
  const elapsed = monthOf(today) === month ? Number(today.slice(8, 10)) : monthOf(today) > month ? days : 0;
  return categories
    .filter((c) => c.kind === "expense" && !c.archived && c.monthlyBudget != null && c.monthlyBudget > 0)
    .map((category) => {
      const budget = category.monthlyBudget ?? 0;
      const s = spent.get(category.id) ?? 0;
      const projected = elapsed > 0 ? (s / elapsed) * days : s;
      const pct = budget > 0 ? (s / budget) * 100 : 0;
      // Early in the month a linear projection is noise: only trust it from day 10.
      const status: BudgetRow["status"] = s > budget ? "over" : (elapsed >= 10 && projected > budget * 1.05) || pct >= 85 ? "warning" : "ok";
      return { category, budget, spent: s, projected, pct, status };
    })
    .sort((a, b) => b.pct - a.pct);
}

// Cumulative spending per day of month, for "this month vs last month" lines.
export function cumulativeDaily(txs: readonly Transaction[], month: MonthKey, fx: FxTable | null): number[] {
  const days = daysInMonth(month);
  const perDay = new Array<number>(days).fill(0);
  for (const tx of txs) {
    if (!countable(tx) || tx.kind !== "expense" || monthOf(tx.date) !== month) continue;
    perDay[Number(tx.date.slice(8, 10)) - 1] += toBase(tx.amount, tx.currency, fx);
  }
  let run = 0;
  return perDay.map((v) => (run += v));
}

// Total spent in the last 12 complete months (FIRE expense estimate) and how many months had data.
export function trailingExpenses(txs: readonly Transaction[], today: DayKey, categories: ReadonlyMap<string, Category>, fx: FxTable | null): { annual: number; months: number } {
  const months = lastMonths(addMonthKey(monthOf(today), -1), 12);
  const rows = monthlySummary(txs, months, categories, fx).filter((r) => r.income > 0 || r.expense > 0);
  if (rows.length === 0) return { annual: 0, months: 0 };
  const avg = rows.reduce((n, r) => n + r.expense, 0) / rows.length;
  return { annual: avg * 12, months: rows.length };
}
