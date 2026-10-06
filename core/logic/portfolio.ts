import type { AssetType, Holding } from "../domain/finance";
import type { Quote } from "../domain/market";
import type { FxTable } from "./money";
import { holdingQuoteKey, valueHolding, type HoldingValuation } from "./networth";

export interface Position extends HoldingValuation {
  holding: Holding;
  quote: Quote | undefined;
  pnl: number;
  pnlPct: number | null;
  // Share of the portfolio, 0-100.
  weight: number;
}

export function positions(holdings: readonly Holding[], quotes: ReadonlyMap<string, Quote>, fx: FxTable | null): Position[] {
  const rows = holdings
    .filter((h) => !h.archived && !h.deletedAt)
    .map((holding) => {
      const key = holdingQuoteKey(holding);
      const quote = key ? quotes.get(key) : undefined;
      const v = valueHolding(holding, quote, fx);
      const pnl = v.valueBase - v.costBase;
      return { ...v, holding, quote, pnl, pnlPct: v.costBase > 0 ? (pnl / v.costBase) * 100 : null, weight: 0 };
    });
  const total = rows.reduce((n, r) => n + Math.max(0, r.valueBase), 0);
  for (const r of rows) r.weight = total > 0 ? (Math.max(0, r.valueBase) / total) * 100 : 0;
  return rows.sort((a, b) => b.valueBase - a.valueBase);
}

export interface PortfolioTotals {
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number | null;
  dayChange: number;
  dayChangePct: number | null;
  monthlyContribution: number;
}

export function totals(rows: readonly Position[]): PortfolioTotals {
  const value = rows.reduce((n, r) => n + r.valueBase, 0);
  const cost = rows.reduce((n, r) => n + r.costBase, 0);
  const dayChange = rows.reduce((n, r) => n + r.dayChangeBase, 0);
  const prev = value - dayChange;
  return {
    value,
    cost,
    pnl: value - cost,
    pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
    dayChange,
    dayChangePct: prev > 0 ? (dayChange / prev) * 100 : null,
    monthlyContribution: rows.reduce((n, r) => n + r.holding.monthlyContribution, 0),
  };
}

export function allocationBy(rows: readonly Position[], key: (p: Position) => string): { key: string; value: number; weight: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r) || "—", (map.get(key(r) || "—") ?? 0) + Math.max(0, r.valueBase));
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()].map(([k, value]) => ({ key: k, value, weight: total > 0 ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
}

export const byAssetType = (rows: readonly Position[]) => allocationBy(rows, (r) => r.holding.assetType as AssetType);

export interface RebalanceRow {
  holding: Holding;
  current: number;
  currentWeight: number;
  targetWeight: number;
  // Positive = buy, in base currency, using only the new contribution (no sells).
  buy: number;
  // Percentage points away from target.
  drift: number;
}

// "Buy-only" rebalancing: the new money goes to the holdings furthest below their target.
export function rebalance(rows: readonly Position[], contribution: number): RebalanceRow[] {
  const targeted = rows.filter((r) => r.holding.targetWeight != null && r.holding.targetWeight > 0);
  if (targeted.length === 0) return [];
  const targetSum = targeted.reduce((n, r) => n + (r.holding.targetWeight ?? 0), 0);
  const total = rows.reduce((n, r) => n + Math.max(0, r.valueBase), 0);
  const after = total + Math.max(0, contribution);
  const deficits = targeted.map((r) => {
    const target = ((r.holding.targetWeight ?? 0) / targetSum) * 100;
    return { r, target, deficit: Math.max(0, (target / 100) * after - r.valueBase) };
  });
  const deficitSum = deficits.reduce((n, d) => n + d.deficit, 0);
  return deficits.map(({ r, target, deficit }) => ({
    holding: r.holding,
    current: r.valueBase,
    currentWeight: r.weight,
    targetWeight: target,
    buy: deficitSum > 0 ? (deficit / deficitSum) * Math.min(contribution, deficitSum) : 0,
    drift: r.weight - target,
  }));
}
