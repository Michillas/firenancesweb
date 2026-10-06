import type { Account, Category, Goal, Purchase, Recurring, Transaction } from "../domain/finance";
import type { Plan } from "../domain/plan";
import { addDays, type DayKey } from "./dates";
import type { MonthForecast } from "./forecast";
import type { NetWorth } from "./networth";
import type { MonthSummary } from "./cashflow";
import type { Position } from "./portfolio";
import { nextOccurrence } from "./recurrence";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Plain-text snapshot of the user's finances for the chat assistant. Compact on purpose:
// free models have small context windows.
export function buildAssistantContext(input: {
  today: DayKey;
  currency: string;
  money: (n: number) => string;
  accounts: (Account & { balance: number })[];
  categories: Category[];
  txs: Transaction[];
  months: MonthSummary[];
  recurring: Recurring[];
  goals: Goal[];
  purchases: Purchase[];
  positions: Position[];
  netWorth: NetWorth;
  forecast: MonthForecast;
  plan: Plan;
}): string {
  const { money, today } = input;
  const cat = new Map(input.categories.map((c) => [c.id, c.name]));
  const acc = new Map(input.accounts.map((a) => [a.id, a.name]));
  const dates = Array.from({ length: 8 }, (_, i) => addDays(today, i - 1)).map((d) => `${d} ${WEEKDAYS[new Date(`${d}T12:00:00`).getDay()]}`);
  const lines: string[] = [
    `TODAY: ${today}. Base currency ${input.currency}. Dates: ${dates.join(", ")}.`,
    `NET WORTH: ${money(input.netWorth.total)} (cash ${money(input.netWorth.cash)}, investments ${money(input.netWorth.investments)}, other assets ${money(input.netWorth.assets)}, debts ${money(input.netWorth.liabilities)}).`,
    `ACCOUNTS: ${input.accounts.map((a) => `${a.name} [${a.type}] ${money(a.balance)}`).join("; ") || "none"}.`,
    `CATEGORIES expense: ${input.categories.filter((c) => c.kind === "expense").map((c) => c.name).join(", ")}. income: ${input.categories.filter((c) => c.kind === "income").map((c) => c.name).join(", ")}.`,
    `MONTHS (income/spent/saved): ${input.months.map((m) => `${m.month} ${money(m.income)}/${money(m.expense)}/${money(m.saved)}`).join("; ")}.`,
    `THIS MONTH FORECAST: expected income ${money(input.forecast.income.expected)}, fixed ${money(input.forecast.fixedTotal)} (pending ${money(input.forecast.fixedPending)}), variable predicted ${money(input.forecast.variablePredicted)} (spent ${money(input.forecast.variableSpent)}), goals ${money(input.forecast.goals)}, purchases ${money(input.forecast.purchases)}, free after all ${money(input.forecast.free)}.`,
    `PAYROLL: gross/year ${money(input.plan.payroll.grossAnnual)}, ${input.plan.payroll.payments} payments, payday ${input.plan.payroll.payday}${input.plan.payroll.netMonthlyOverride != null ? `, net/month ${money(input.plan.payroll.netMonthlyOverride)}` : ""}. Split: ${input.plan.buckets.map((b) => `${b.name} ${b.percent}%`).join(", ")}.`,
    `RECURRING: ${input.recurring.filter((r) => r.active).map((r) => `${r.name} ${money(r.amount)}/${r.cycle} next ${nextOccurrence(r, today) ?? "-"}`).join("; ") || "none"}.`,
    `GOALS: ${input.goals.filter((g) => !g.done).map((g) => `${g.name} ${money(g.saved)}/${money(g.target)}${g.deadline ? ` by ${g.deadline}` : ""}`).join("; ") || "none"}.`,
    `PLANNED PURCHASES: ${input.purchases.filter((p) => p.status === "planned").map((p) => `${p.name} ${money(p.price)}${p.targetDate ? ` by ${p.targetDate}` : ""}`).join("; ") || "none"}.`,
    `PORTFOLIO: ${input.positions.map((p) => `${p.holding.name}${p.holding.symbol ? ` (${p.holding.symbol})` : ""} ${money(p.valueBase)} ${p.weight.toFixed(1)}% P/L ${p.pnlPct == null ? "?" : p.pnlPct.toFixed(1)}%`).join("; ") || "none"}.`,
    `FIRE: target age ${input.plan.fire.targetAge}, withdrawal ${input.plan.fire.withdrawalRate}%, expected return ${input.plan.fire.expectedReturn}%, inflation ${input.plan.fire.inflation}%.`,
    `RECENT TRANSACTIONS (id | date | amount | category | account | description):\n${input.txs
      .slice(0, 40)
      .map((t) => `${t.id} | ${t.date} | ${t.kind === "expense" ? "-" : t.kind === "income" ? "+" : "↔"}${t.amount} | ${t.categoryId ? cat.get(t.categoryId) ?? "" : ""} | ${t.accountId ? acc.get(t.accountId) ?? "" : ""} | ${t.description}`)
      .join("\n")}`,
  ];
  return lines.join("\n");
}
