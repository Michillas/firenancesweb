import { useCallback, useMemo } from "react";
import type { Account, Category, Goal } from "@/core/domain/finance";
import type { Quote } from "@/core/domain/market";
import { buildAgenda } from "@/core/logic/agenda";
import { trailingExpenses } from "@/core/logic/cashflow";
import { addMonthKey, monthOf } from "@/core/logic/dates";
import { forecastMonth, projectCash, purchaseMonthly } from "@/core/logic/forecast";
import type { FxTable } from "@/core/logic/money";
import { accountBalance, computeNetWorth } from "@/core/logic/networth";
import { averageMonthlyIncome } from "@/core/logic/payroll";
import { positions, totals } from "@/core/logic/portfolio";
import { formatMoney, type MoneyOptions } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "./create-collection-store";
import { useDoc } from "./create-doc-store";
import { accounts, assets, categories, events, feeds, fxRates, goals, holdings, plan, purchases, quotes, recurring, settings, transactions } from "./stores";

export function useBaseCurrency(): string {
  return useDoc(settings).currency;
}

export function useFx(): FxTable | null {
  const base = useBaseCurrency();
  const rows = useCollection(fxRates);
  return useMemo(() => {
    const row = rows.find((r) => r.id === base);
    return row ? { base, rates: row.rates } : { base, rates: {} };
  }, [rows, base]);
}

// Formats money in the base currency, honouring privacy mode.
export function useMoney(): (value: number, opts?: MoneyOptions) => string {
  const s = useDoc(settings);
  return useCallback((value: number, opts: MoneyOptions = {}) => formatMoney(value, { currency: s.currency, hidden: s.privacyMode, ...opts }), [s.currency, s.privacyMode]);
}

export function useQuoteMap(): Map<string, Quote> {
  const rows = useCollection(quotes);
  return useMemo(() => new Map(rows.map((q) => [q.id, q])), [rows]);
}

export function useCategories(kind?: Category["kind"]): Category[] {
  const rows = useCollection(categories);
  return useMemo(() => rows.filter((c) => !c.archived && (!kind || c.kind === kind)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [rows, kind]);
}

export function useCategoryMap(): Map<string, Category> {
  const rows = useCollection(categories);
  return useMemo(() => new Map(rows.map((c) => [c.id, c])), [rows]);
}

export function useAccounts(opts: { includeArchived?: boolean } = {}): (Account & { balance: number })[] {
  const rows = useCollection(accounts);
  const txs = useCollection(transactions);
  return useMemo(
    () =>
      rows
        .filter((a) => opts.includeArchived || !a.archived)
        .map((a) => ({ ...a, balance: accountBalance(a, txs) }))
        .sort((a, b) => b.balance - a.balance),
    [rows, txs, opts.includeArchived],
  );
}

export function useTransactions() {
  const rows = useCollection(transactions);
  return useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [rows]);
}

export function useNetWorth() {
  const accs = useCollection(accounts);
  const txs = useCollection(transactions);
  const hs = useCollection(holdings);
  const as = useCollection(assets);
  const quoteMap = useQuoteMap();
  const fx = useFx();
  return useMemo(() => computeNetWorth({ accounts: accs, txs, holdings: hs, quotes: quoteMap, assets: as, fx }), [accs, txs, hs, as, quoteMap, fx]);
}

export function usePositions() {
  const hs = useCollection(holdings);
  const quoteMap = useQuoteMap();
  const fx = useFx();
  return useMemo(() => {
    const rows = positions(hs, quoteMap, fx);
    return { rows, totals: totals(rows) };
  }, [hs, quoteMap, fx]);
}

export function useGoalSaved(): (g: Goal) => number {
  const accs = useAccounts({ includeArchived: true });
  return useCallback((g: Goal) => (g.accountId ? Math.max(0, accs.find((a) => a.id === g.accountId)?.balance ?? g.saved) : g.saved), [accs]);
}

export function useForecast(month?: string) {
  const today = useToday();
  const txs = useCollection(transactions);
  const rec = useCollection(recurring);
  const cats = useCollection(categories);
  const p = useDoc(plan);
  const gs = useCollection(goals);
  const ps = useCollection(purchases);
  const fx = useFx();
  const target = month ?? monthOf(today);
  return useMemo(() => forecastMonth({ month: target, today, txs, recurring: rec, categories: cats, payroll: p.payroll, goals: gs, purchases: ps, fx }), [target, today, txs, rec, cats, p.payroll, gs, ps, fx]);
}

export function useMonthlyIncome(): number {
  const p = useDoc(plan);
  return useMemo(() => averageMonthlyIncome(p.payroll), [p.payroll]);
}

// Annual spending used by FIRE: the user's value, or the trailing 12 months of real expenses.
export function useAnnualExpenses(): { annual: number; source: "manual" | "history" | "none"; months: number } {
  const today = useToday();
  const txs = useCollection(transactions);
  const catMap = useCategoryMap();
  const fx = useFx();
  const p = useDoc(plan);
  return useMemo(() => {
    if (p.fire.annualExpenses != null) return { annual: p.fire.annualExpenses, source: "manual" as const, months: 0 };
    const t = trailingExpenses(txs, today, catMap, fx);
    return t.months > 0 ? { annual: t.annual, source: "history" as const, months: t.months } : { annual: 0, source: "none" as const, months: 0 };
  }, [p.fire.annualExpenses, txs, today, catMap, fx]);
}

export function useAgenda(from: string, to: string) {
  const rec = useCollection(recurring);
  const p = useDoc(plan);
  const ps = useCollection(purchases);
  const gs = useCollection(goals);
  const evs = useCollection(events);
  const hs = useCollection(holdings);
  const fds = useCollection(feeds);
  const s = useDoc(settings);
  return useMemo(
    () => buildAgenda({ from, to, recurring: rec, payroll: p.payroll, purchases: ps, goals: gs, events: evs, holdings: hs, feeds: fds, tax: { enabled: s.showTaxCalendar, selfEmployed: s.selfEmployed } }),
    [from, to, rec, p.payroll, ps, gs, evs, hs, fds, s.showTaxCalendar, s.selfEmployed],
  );
}

// Liquid cash month by month for the next `months` (starts next month).
export function useCashProjection(months = 12) {
  const today = useToday();
  const nw = useNetWorth();
  const forecast = useForecast();
  const txs = useCollection(transactions);
  const rec = useCollection(recurring);
  const p = useDoc(plan);
  const ps = useCollection(purchases);
  const fx = useFx();
  return useMemo(() => {
    const start = addMonthKey(monthOf(today), 1);
    const oneOffs = ps
      .filter((x) => x.status === "planned")
      .map((x) => ({ month: x.targetDate && monthOf(x.targetDate) >= start ? monthOf(x.targetDate) : addMonthKey(start, x.installments > 0 ? 0 : 11), amount: x.installments > 0 ? 0 : Math.max(0, x.price - x.saved) }))
      .filter((o) => o.amount > 0);
    const installments = ps.filter((x) => x.status === "planned" && x.installments > 0).reduce((n, x) => n + purchaseMonthly(x, today), 0);
    return projectCash({ start, months, startBalance: nw.cash + Math.max(forecast.remaining, -nw.cash), txs, recurring: rec, payroll: p.payroll, outflows: installments, oneOffs, fx });
  }, [today, nw.cash, forecast.remaining, txs, rec, p.payroll, ps, fx, months]);
}
