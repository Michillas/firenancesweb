import type { AssistantAction } from "@/core/ai";
import { matchCategoryName } from "@/core/logic/categorize";
import { formatMoney } from "@/lib/format";
import { accounts, categories, events, goals, purchases, recurring, settings, transactions } from "../stores";
import { setAccountBalance } from "./finance";

export interface ActionOutcome {
  ok: boolean;
  summary: string;
  undo?: () => void;
}

export type PlannedAction = { kind: "now"; outcome: ActionOutcome } | { kind: "confirm"; summary: string; run: () => ActionOutcome };

const money = (n: number) => formatMoney(n, { currency: settings.get().currency });
const findAccount = (name: string | null | undefined) => (name ? accounts.list().find((a) => a.name.toLowerCase() === name.toLowerCase()) : undefined);

// Turns a validated assistant action into a change. Deletions wait for the user's confirmation.
export function planAction(action: AssistantAction): PlannedAction {
  const base = settings.get().currency;
  switch (action.type) {
    case "add_transaction": {
      const t = transactions.create({
        date: action.date,
        amount: action.amount,
        kind: action.kind,
        currency: base,
        accountId: findAccount(action.account)?.id ?? null,
        toAccountId: null,
        categoryId: matchCategoryName(action.category, categories.list(), action.kind),
        description: action.description,
        merchant: "",
        notes: "",
        tags: [],
        source: "assistant",
        recurringId: null,
        excluded: false,
      });
      return { kind: "now", outcome: { ok: true, summary: `${action.kind === "expense" ? "Gasto" : "Ingreso"} añadido: ${action.description} · ${money(action.amount)} (${action.date})`, undo: () => transactions.remove(t.id) } };
    }
    case "delete_transaction": {
      const t = transactions.get(action.id);
      if (!t) return { kind: "now", outcome: { ok: false, summary: "No encuentro ese movimiento" } };
      return {
        kind: "confirm",
        summary: `¿Eliminar «${t.description}» de ${money(t.amount)} (${t.date})?`,
        run: () => {
          transactions.remove(t.id);
          return { ok: true, summary: `Eliminado: ${t.description}`, undo: () => transactions.update(t.id, { deletedAt: null }) };
        },
      };
    }
    case "add_recurring": {
      const r = recurring.create({
        name: action.name,
        kind: action.kind,
        amount: action.amount,
        currency: base,
        cycle: action.cycle,
        every: 1,
        startDate: action.startDate,
        categoryId: matchCategoryName(action.category, categories.list(), action.kind === "income" ? "income" : "expense"),
      });
      return { kind: "now", outcome: { ok: true, summary: `Recurrente añadido: ${action.name} · ${money(action.amount)}`, undo: () => recurring.remove(r.id) } };
    }
    case "add_purchase": {
      const p = purchases.create({ name: action.name, price: action.price, targetDate: action.targetDate ?? null, need: action.need ?? false });
      return { kind: "now", outcome: { ok: true, summary: `Compra planeada: ${action.name} · ${money(action.price)}`, undo: () => purchases.remove(p.id) } };
    }
    case "add_goal": {
      const g = goals.create({ name: action.name, target: action.target, deadline: action.deadline ?? null, monthlyContribution: action.monthlyContribution ?? 0, kind: action.kind });
      return { kind: "now", outcome: { ok: true, summary: `Meta creada: ${action.name} · ${money(action.target)}`, undo: () => goals.remove(g.id) } };
    }
    case "set_balance": {
      const a = findAccount(action.account);
      if (!a) return { kind: "now", outcome: { ok: false, summary: `No existe la cuenta «${action.account}»` } };
      const before = a.openingBalance;
      setAccountBalance(a, action.balance);
      return { kind: "now", outcome: { ok: true, summary: `Saldo de ${a.name} ajustado a ${money(action.balance)}`, undo: () => accounts.update(a.id, { openingBalance: before }) } };
    }
    case "add_event": {
      const e = events.create({ title: action.title, date: action.date, amount: action.amount ?? null, notes: action.notes ?? "" });
      return { kind: "now", outcome: { ok: true, summary: `Evento añadido al calendario: ${action.title} (${action.date})`, undo: () => events.remove(e.id) } };
    }
  }
}
