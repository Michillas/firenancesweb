import type { Category, Transaction, TxKind } from "../domain/finance";
import { normalizeMerchant } from "./cashflow";

const fold = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")} `;

// Learns "merchant -> category" from what the user already categorised (most recent wins).
export function learnRules(history: readonly Transaction[]): Map<string, string> {
  const rules = new Map<string, string>();
  const sorted = [...history].filter((t) => t.categoryId && !t.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const key = normalizeMerchant(t.merchant || t.description);
    if (key) rules.set(key, t.categoryId!);
  }
  return rules;
}

// Guess a category: the user's own history first, then the category keywords.
export function guessCategory(input: { description: string; merchant?: string; kind: TxKind }, categories: readonly Category[], rules: ReadonlyMap<string, string>): string | null {
  if (input.kind === "transfer") return null;
  const key = normalizeMerchant(input.merchant || input.description);
  const learned = key ? rules.get(key) : undefined;
  if (learned && categories.some((c) => c.id === learned && c.kind === input.kind)) return learned;
  const text = fold(`${input.merchant ?? ""} ${input.description}`);
  let best: { id: string; len: number } | null = null;
  for (const c of categories) {
    if (c.kind !== input.kind || c.archived) continue;
    for (const kw of c.keywords) {
      const k = fold(kw).trim();
      if (k && text.includes(k) && (!best || k.length > best.len)) best = { id: c.id, len: k.length };
    }
  }
  return best?.id ?? null;
}

// Name lookup used by AI imports: "supermercado" / "Supermercado 🛒" -> category id.
export function matchCategoryName(name: string | null | undefined, categories: readonly Category[], kind: TxKind): string | null {
  if (!name) return null;
  const n = fold(name).replace(/[^a-z0-9 ]/g, "").trim();
  if (!n) return null;
  const pool = categories.filter((c) => !c.archived && (kind === "transfer" || c.kind === kind));
  const exact = pool.find((c) => fold(c.name).replace(/[^a-z0-9 ]/g, "").trim() === n);
  if (exact) return exact.id;
  const partial = pool.find((c) => {
    const cn = fold(c.name).replace(/[^a-z0-9 ]/g, "").trim();
    return cn.includes(n) || n.includes(cn);
  });
  return partial?.id ?? null;
}

// Same date + amount + similar text = probably the same movement imported twice.
export function isDuplicate(candidate: Pick<Transaction, "date" | "amount" | "kind" | "description">, existing: readonly Transaction[]): boolean {
  const key = normalizeMerchant(candidate.description);
  return existing.some((t) => !t.deletedAt && t.date === candidate.date && Math.abs(t.amount - candidate.amount) < 0.005 && t.kind === candidate.kind && (normalizeMerchant(t.description) === key || normalizeMerchant(t.merchant) === key || !key));
}
