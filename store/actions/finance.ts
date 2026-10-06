import { DEFAULT_CATEGORIES, categoryId } from "@/core/domain/defaults";
import type { Account, Transaction, TxKind } from "@/core/domain/finance";
import { guessCategory, isDuplicate, learnRules, matchCategoryName } from "@/core/logic/categorize";
import { toKey, todayKey } from "@/core/logic/dates";
import { computeNetWorth, openingFor } from "@/core/logic/networth";
import { pendingCharges } from "@/core/logic/recurrence";
import { accounts, assets, categories, fxRates, holdings, quotes, recurring, settings, snapshots, transactions } from "../stores";

// First run: default categories with stable ids. Re-adds a default only if it never existed.
export function seedCategories() {
  const existing = new Set(categories.rawAll().map((c) => c.id));
  DEFAULT_CATEGORIES.forEach((c, order) => {
    const id = categoryId(c.slug);
    if (existing.has(id)) return;
    const { slug: _slug, ...rest } = c;
    categories.upsert(id, { ...rest, monthlyBudget: null, archived: false, order });
  });
}

export function setAccountBalance(account: Account, balance: number) {
  accounts.update(account.id, { openingBalance: openingFor(account, transactions.list(), balance) });
}

export interface ImportDraft {
  date: string;
  amount: number;
  kind: TxKind;
  description: string;
  merchant: string;
  category?: string | null;
  categoryId?: string | null;
  account?: string | null;
  accountId?: string | null;
  currency?: string | null;
}

export interface PreparedRow {
  draft: ImportDraft;
  categoryId: string | null;
  accountId: string | null;
  duplicate: boolean;
  include: boolean;
}

// Resolves category/account names, guesses missing categories and flags duplicates before saving.
export function prepareImport(drafts: ImportDraft[], defaultAccountId: string | null): PreparedRow[] {
  const cats = categories.list();
  const accs = accounts.list();
  const existing = transactions.list();
  const rules = learnRules(existing);
  return drafts.map((draft) => {
    const named = draft.categoryId ?? matchCategoryName(draft.category, cats, draft.kind);
    const categoryIdValue = named ?? guessCategory(draft, cats, rules);
    const acc = draft.accountId ?? (draft.account ? accs.find((a) => a.name.toLowerCase() === draft.account!.toLowerCase())?.id : undefined) ?? defaultAccountId;
    const duplicate = isDuplicate(draft, existing.filter((t) => !acc || t.accountId === acc || !t.accountId));
    return { draft, categoryId: categoryIdValue, accountId: acc ?? null, duplicate, include: !duplicate };
  });
}

export function commitImport(rows: PreparedRow[], source: Transaction["source"]): number {
  const base = settings.get().currency;
  const chosen = rows.filter((r) => r.include);
  transactions.createMany(
    chosen.map((r) => ({
      date: r.draft.date,
      amount: Math.round(r.draft.amount * 100) / 100,
      kind: r.draft.kind,
      currency: (r.draft.currency && /^[A-Z]{3}$/.test(r.draft.currency) ? r.draft.currency : base) as Transaction["currency"],
      accountId: r.accountId,
      toAccountId: null,
      categoryId: r.draft.kind === "transfer" ? null : r.categoryId,
      description: r.draft.description,
      merchant: r.draft.merchant,
      notes: "",
      tags: [],
      source,
      recurringId: null,
      excluded: false,
    })),
  );
  return chosen.length;
}

// Turns recurring charges whose date has passed into transactions (once per date).
export function logDueRecurring(today = todayKey()): number {
  let created = 0;
  for (const r of recurring.list()) {
    // Charges dated before the subscription was added are never back-filled.
    const due = pendingCharges(r, today, toKey(new Date(r.createdAt)));
    if (due.length === 0) continue;
    transactions.createMany(
      due.map((date) => ({
        date,
        amount: r.amount,
        kind: r.kind === "income" ? ("income" as const) : ("expense" as const),
        currency: r.currency,
        accountId: r.accountId,
        toAccountId: null,
        categoryId: r.categoryId,
        description: r.name,
        merchant: r.name,
        notes: "",
        tags: [],
        source: "recurring" as const,
        recurringId: r.id,
        excluded: false,
      })),
    );
    recurring.update(r.id, { loggedThrough: due[due.length - 1] });
    created += due.length;
  }
  return created;
}

// Keeps one net-worth row per day (the history chart). Cheap: called after hydration and on changes.
export function recordSnapshot(today = todayKey()) {
  const fx = fxRates.get(settings.get().currency) ?? null;
  const nw = computeNetWorth({
    accounts: accounts.list(),
    txs: transactions.list(),
    holdings: holdings.list(),
    quotes: new Map(quotes.list().map((q) => [q.id, q])),
    assets: assets.list(),
    fx,
  });
  if (nw.total === 0 && nw.cash === 0 && nw.investments === 0 && snapshots.list().length === 0) return;
  const id = `nw_${today}`;
  const prev = snapshots.get(id);
  const row = { date: today, cash: nw.cash, investments: nw.investments, assets: nw.assets, liabilities: nw.liabilities, total: nw.total, invested: nw.invested };
  if (prev && Math.abs(prev.total - row.total) < 0.01 && Math.abs(prev.invested - row.invested) < 0.01) return;
  snapshots.upsert(id, row);
}
