import type { Category, Goal, Purchase, Recurring, Transaction } from "../domain/finance";
import type { Bucket, Payroll } from "../domain/plan";
import { addMonthKey, diffMonths, firstDay, lastDay, monthOf, type DayKey, type MonthKey } from "./dates";
import { toBase, type FxTable } from "./money";
import { averageByCategory, countable } from "./cashflow";
import { extrasMonthly, netForMonth } from "./payroll";
import { monthlyEquivalent, occurrences } from "./recurrence";

export interface FixedCharge {
  recurring: Recurring;
  date: DayKey;
  amount: number;
  paid: boolean;
}

export interface CategoryForecast {
  categoryId: string;
  spent: number;
  // Expected total for the month: max(spent, average) for variable categories, plus fixed charges.
  predicted: number;
  average: number;
}

export interface MonthForecast {
  month: MonthKey;
  income: { expected: number; received: number; salary: number; extras: number; recurring: number };
  fixed: FixedCharge[];
  fixedTotal: number;
  fixedPending: number;
  variablePredicted: number;
  variableSpent: number;
  byCategory: CategoryForecast[];
  goals: number;
  purchases: number;
  // Income - fixed - variable - goal contributions - purchase savings.
  free: number;
  // Same, but only counting what is still to come this month.
  remaining: number;
}

// Monthly amount needed for a purchase to be paid in full by its target date (or 12 months).
export function purchaseMonthly(p: Purchase, today: DayKey): number {
  if (p.status !== "planned") return 0;
  if (p.installments > 0) return installmentPayment(p.price - p.saved, p.installments, p.apr);
  const months = p.targetDate ? Math.max(1, diffMonths(monthOf(today), monthOf(p.targetDate))) : 12;
  return Math.max(0, p.price - p.saved) / months;
}

// French amortisation (cuota constante).
export function installmentPayment(principal: number, months: number, aprPct: number): number {
  if (months <= 0) return principal;
  const r = aprPct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function goalMonthly(g: Goal): number {
  return g.done ? 0 : g.monthlyContribution;
}

export function forecastMonth(input: {
  month: MonthKey;
  today: DayKey;
  txs: readonly Transaction[];
  recurring: readonly Recurring[];
  categories: readonly Category[];
  payroll: Payroll;
  goals: readonly Goal[];
  purchases: readonly Purchase[];
  fx: FxTable | null;
}): MonthForecast {
  const { month, today, fx } = input;
  const from = firstDay(month);
  const to = lastDay(month);
  const monthTxs = input.txs.filter((t) => countable(t) && t.date >= from && t.date <= to);

  const salary = netForMonth(input.payroll, month);
  const extras = extrasMonthly(input.payroll);
  let recurringIncome = 0;
  const fixed: FixedCharge[] = [];
  for (const r of input.recurring) {
    if (!r.active) continue;
    for (const date of occurrences(r, from, to)) {
      if (r.trialUntil && date <= r.trialUntil) continue;
      const amount = toBase(r.amount, r.currency, fx);
      if (r.kind === "income") {
        recurringIncome += amount;
        continue;
      }
      const paid = date <= today || monthTxs.some((t) => t.recurringId === r.id && t.date === date);
      fixed.push({ recurring: r, date, amount, paid });
    }
  }
  fixed.sort((a, b) => a.date.localeCompare(b.date));
  const received = monthTxs.filter((t) => t.kind === "income").reduce((n, t) => n + toBase(t.amount, t.currency, fx), 0);
  const expected = salary + extras + recurringIncome;

  // Variable spending: everything not produced by a recurring charge.
  const averages = averageByCategory(input.txs, month, 3, fx, { skipRecurring: true });
  const spentVariable = new Map<string, number>();
  const spentFixed = new Map<string, number>();
  for (const t of monthTxs) {
    if (t.kind !== "expense") continue;
    const key = t.categoryId ?? "none";
    const target = t.recurringId ? spentFixed : spentVariable;
    target.set(key, (target.get(key) ?? 0) + toBase(t.amount, t.currency, fx));
  }
  const fixedByCat = new Map<string, number>();
  for (const f of fixed) {
    const key = f.recurring.categoryId ?? "none";
    fixedByCat.set(key, (fixedByCat.get(key) ?? 0) + f.amount);
  }
  const savingsCats = new Set(input.categories.filter((c) => c.group === "savings").map((c) => c.id));
  const keys = new Set([...averages.keys(), ...spentVariable.keys(), ...fixedByCat.keys()]);
  const byCategory: CategoryForecast[] = [];
  let variablePredicted = 0;
  let variableSpent = 0;
  for (const key of keys) {
    const spent = spentVariable.get(key) ?? 0;
    const average = averages.get(key) ?? 0;
    const variable = monthOf(today) > month ? spent : Math.max(spent, average);
    const fixedPart = Math.max(fixedByCat.get(key) ?? 0, spentFixed.get(key) ?? 0);
    if (!savingsCats.has(key)) {
      variablePredicted += variable;
      variableSpent += spent;
    }
    byCategory.push({ categoryId: key, spent: spent + (spentFixed.get(key) ?? 0), predicted: variable + fixedPart, average });
  }
  byCategory.sort((a, b) => b.predicted - a.predicted);

  const fixedTotal = fixed.reduce((n, f) => n + f.amount, 0);
  const fixedPending = fixed.filter((f) => !f.paid).reduce((n, f) => n + f.amount, 0);
  const goals = input.goals.reduce((n, g) => n + goalMonthly(g), 0);
  const purchases = input.purchases.reduce((n, p) => n + purchaseMonthly(p, today), 0);
  const free = expected - fixedTotal - variablePredicted - goals - purchases;
  const incomeLeft = Math.max(0, expected - received);
  const remaining = incomeLeft - fixedPending - Math.max(0, variablePredicted - variableSpent);
  return {
    month,
    income: { expected, received, salary, extras, recurring: recurringIncome },
    fixed,
    fixedTotal,
    fixedPending,
    variablePredicted,
    variableSpent,
    byCategory,
    goals,
    purchases,
    free,
    remaining,
  };
}

export interface CashPoint {
  month: MonthKey;
  income: number;
  fixed: number;
  variable: number;
  oneOff: number;
  net: number;
  balance: number;
}

// 12-month liquid-cash projection: payroll (with extra payments), exact recurring charges and
// average variable spending. Goal/purchase/investment contributions leave the liquid balance.
export function projectCash(input: {
  start: MonthKey;
  months: number;
  startBalance: number;
  txs: readonly Transaction[];
  recurring: readonly Recurring[];
  payroll: Payroll;
  // Monthly money that leaves liquid accounts (investment contributions not tracked as recurring).
  outflows: number;
  // One-off payments in a given month (planned purchases on their target date).
  oneOffs?: { month: MonthKey; amount: number }[];
  fx: FxTable | null;
}): CashPoint[] {
  const averages = averageByCategory(input.txs, input.start, 3, input.fx, { skipRecurring: true });
  const variable = [...averages.values()].reduce((a, b) => a + b, 0);
  let balance = input.startBalance;
  const out: CashPoint[] = [];
  for (let i = 0; i < input.months; i++) {
    const month = addMonthKey(input.start, i);
    let fixed = 0;
    let recurringIncome = 0;
    for (const r of input.recurring) {
      if (!r.active) continue;
      for (const date of occurrences(r, firstDay(month), lastDay(month))) {
        if (r.trialUntil && date <= r.trialUntil) continue;
        const amount = toBase(r.amount, r.currency, input.fx);
        if (r.kind === "income") recurringIncome += amount;
        else fixed += amount;
      }
    }
    const income = netForMonth(input.payroll, month) + extrasMonthly(input.payroll) + recurringIncome;
    const oneOff = (input.oneOffs ?? []).filter((o) => o.month === month).reduce((n, o) => n + o.amount, 0);
    const net = income - fixed - variable - input.outflows - oneOff;
    balance += net;
    out.push({ month, income, fixed, variable, oneOff, net, balance });
  }
  return out;
}

export interface BucketPlan {
  bucket: Bucket;
  amount: number;
  // What history says actually goes there (needs/wants from categories, savings/invest from the plan).
  actual: number | null;
}

// Splits the net monthly income across the user's buckets and compares with real spending.
export function planBuckets(buckets: readonly Bucket[], income: number, actualByGroup: { needs: number; wants: number; savings: number }): BucketPlan[] {
  return buckets.map((bucket) => ({
    bucket,
    amount: (income * bucket.percent) / 100,
    actual: bucket.kind === "needs" ? actualByGroup.needs : bucket.kind === "wants" ? actualByGroup.wants : null,
  }));
}

export function recurringMonthlyTotal(recurring: readonly Recurring[], fx: FxTable | null, kind: Recurring["kind"] | "charges" = "charges"): number {
  return recurring
    .filter((r) => r.active && (kind === "charges" ? r.kind !== "income" : r.kind === kind))
    .reduce((n, r) => n + toBase(monthlyEquivalent(r), r.currency, fx), 0);
}

export interface PurchaseSchedule {
  purchase: Purchase;
  // Month when it would be fully funded if free money went to purchases in priority order.
  fundedMonth: MonthKey | null;
  monthsNeeded: number | null;
  onTime: boolean | null;
}

// Waterfall: each month's free money fills the highest-priority purchase first.
export function schedulePurchases(purchases: readonly Purchase[], monthlyFree: number, today: DayKey, horizon = 60): PurchaseSchedule[] {
  const queue = purchases
    .filter((p) => p.status === "planned")
    .sort((a, b) => a.priority - b.priority || (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"))
    .map((p) => ({ p, missing: Math.max(0, p.price - p.saved) }));
  const funded = new Map<string, number>();
  for (const q of queue) if (q.missing === 0) funded.set(q.p.id, 0);
  if (monthlyFree > 0) {
    for (let m = 1; m <= horizon && funded.size < queue.length; m++) {
      let budget = monthlyFree;
      for (const q of queue) {
        if (funded.has(q.p.id) || budget <= 0) continue;
        const used = Math.min(budget, q.missing);
        q.missing -= used;
        budget -= used;
        if (q.missing <= 0.005) funded.set(q.p.id, m);
      }
    }
  }
  const start = monthOf(today);
  return queue.map(({ p }) => {
    const months = funded.get(p.id);
    const fundedMonth = months == null ? null : addMonthKey(start, months);
    return { purchase: p, fundedMonth, monthsNeeded: months ?? null, onTime: p.targetDate ? (fundedMonth != null ? fundedMonth <= monthOf(p.targetDate) : false) : null };
  });
}
