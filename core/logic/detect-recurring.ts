import type { Cycle, Recurring, Transaction } from "../domain/finance";
import { normalizeMerchant } from "./cashflow";
import { addDays, addMonths, diffDays, type DayKey } from "./dates";

export interface RecurringSuggestion {
  key: string;
  name: string;
  amount: number;
  cycle: Cycle;
  lastDate: DayKey;
  nextDate: DayKey;
  count: number;
  categoryId: string | null;
  accountId: string | null;
}

const CYCLE_DAYS: [Cycle, number, number][] = [
  ["weekly", 6, 8],
  ["monthly", 26, 35],
  ["quarterly", 85, 97],
  ["yearly", 350, 380],
];

// Finds charges that repeat with a stable cadence and amount (Netflix every ~30 days, insurance
// every ~365) and that are not already tracked as a subscription.
export function detectRecurring(txs: readonly Transaction[], existing: readonly Recurring[], today: DayKey): RecurringSuggestion[] {
  const known = new Set(existing.map((r) => normalizeMerchant(r.name)));
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.kind !== "expense" || t.recurringId || t.excluded || t.deletedAt) continue;
    const key = normalizeMerchant(t.merchant || t.description);
    if (!key || key.length < 3) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: RecurringSuggestion[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2 || [...known].some((k) => k && (k.includes(key) || key.includes(k)))) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((t, i) => diffDays(sorted[i].date, t.date));
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const match = CYCLE_DAYS.find(([, lo, hi]) => median >= lo && median <= hi);
    if (!match) continue;
    const [cycle] = match;
    if (cycle !== "yearly" && sorted.length < 3) continue;
    const regular = gaps.filter((g) => g >= match[1] && g <= match[2]).length / gaps.length;
    const amounts = sorted.map((t) => t.amount);
    const last = sorted[sorted.length - 1];
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stable = amounts.every((a) => Math.abs(a - avg) <= Math.max(1, avg * 0.15));
    if (regular < 0.6 || !stable) continue;
    // Stale: the last charge is long overdue, so it was probably cancelled.
    if (diffDays(last.date, today) > match[2] * 1.6) continue;
    const next = cycle === "weekly" ? addDays(last.date, 7) : addMonths(last.date, cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12);
    out.push({ key, name: last.merchant || last.description, amount: Math.round(last.amount * 100) / 100, cycle, lastDate: last.date, nextDate: next, count: sorted.length, categoryId: last.categoryId, accountId: last.accountId });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
