import type { Transaction } from "../domain/finance";

// 1 unit of `base` = rates[c] units of currency c (the shape returned by ECB-based FX APIs).
export interface FxTable {
  base: string;
  rates: Record<string, number>;
}

export function toBase(amount: number, currency: string, fx: FxTable | null | undefined): number {
  if (!fx || !currency || currency === fx.base) return amount;
  const rate = fx.rates[currency];
  return rate && rate > 0 ? amount / rate : amount;
}

export function convert(amount: number, from: string, to: string, fx: FxTable | null | undefined): number {
  if (from === to) return amount;
  const inBase = toBase(amount, from, fx);
  if (!fx || to === fx.base) return inBase;
  const rate = fx.rates[to];
  return rate && rate > 0 ? inBase * rate : inBase;
}

// Effect of a transaction on "money I have": transfers move money around and count as zero.
export function signedAmount(tx: Pick<Transaction, "kind" | "amount">): number {
  if (tx.kind === "expense") return -tx.amount;
  if (tx.kind === "income") return tx.amount;
  return 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function sumBy<T>(items: readonly T[], fn: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += fn(item);
  return total;
}

export function groupSum<T>(items: readonly T[], key: (item: T) => string, value: (item: T) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    out.set(k, (out.get(k) ?? 0) + value(item));
  }
  return out;
}
