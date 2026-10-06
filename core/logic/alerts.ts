import type { Goal, Purchase, Recurring } from "../domain/finance";
import type { BudgetRow } from "./cashflow";
import { addDays, diffDays, diffMonths, monthOf, type DayKey } from "./dates";
import type { CashPoint, MonthForecast } from "./forecast";
import { purchaseMonthly } from "./forecast";
import { requiredMonthly } from "./projection";
import type { RebalanceRow } from "./portfolio";

export type AlertTone = "danger" | "warning" | "info" | "success";

export interface Alert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
}

type Money = (n: number) => string;

// Plain-language observations for the dashboard. Pure: the caller provides all the numbers.
export function buildAlerts(input: {
  today: DayKey;
  budgets: readonly BudgetRow[];
  forecast: MonthForecast;
  cash: readonly CashPoint[];
  recurring: readonly Recurring[];
  goals: readonly Goal[];
  goalSaved: (g: Goal) => number;
  purchases: readonly Purchase[];
  rebalance: readonly RebalanceRow[];
  liquidCash: number;
  monthlyExpenses: number;
  categoryName: (id: string) => string;
  categoryAverages: ReadonlyMap<string, number>;
  money: Money;
  date: (key: DayKey) => string;
}): Alert[] {
  const { today, money, date } = input;
  const out: Alert[] = [];

  for (const b of input.budgets) {
    if (b.status === "over") out.push({ id: `budget-over-${b.category.id}`, tone: "danger", title: `Presupuesto superado: ${b.category.name}`, detail: `Llevas ${money(b.spent)} de ${money(b.budget)} este mes.`, href: "/analysis" });
    else if (b.status === "warning") out.push({ id: `budget-warn-${b.category.id}`, tone: "warning", title: `${b.category.name} va camino de pasarse`, detail: `${money(b.spent)} gastados; al ritmo actual acabarás en ~${money(b.projected)} (presupuesto ${money(b.budget)}).`, href: "/analysis" });
  }

  for (const c of input.forecast.byCategory) {
    const avg = input.categoryAverages.get(c.categoryId) ?? 0;
    if (avg >= 50 && c.spent > avg * 1.5) {
      out.push({ id: `unusual-${c.categoryId}`, tone: "warning", title: `Gasto inusual en ${input.categoryName(c.categoryId)}`, detail: `${money(c.spent)} este mes frente a ${money(avg)} de media.`, href: "/analysis" });
    }
  }

  const soon = addDays(today, 7);
  for (const r of input.recurring) {
    if (r.active && r.trialUntil && r.trialUntil >= today && r.trialUntil <= soon) {
      out.push({ id: `trial-${r.id}`, tone: "warning", title: `La prueba de ${r.name} termina pronto`, detail: `El ${date(r.trialUntil)} empezará a cobrarse ${money(r.amount)}. Cancélala antes si no la usas.`, href: "/subscriptions" });
    }
  }

  const negative = input.cash.find((p) => p.balance < 0);
  if (negative) out.push({ id: "cash-negative", tone: "danger", title: "Tu liquidez se queda en negativo", detail: `Con los gastos previstos, en ${negative.month} tendrías ${money(negative.balance)}. Revisa compras planeadas o aportaciones.`, href: "/payroll" });
  else if (input.forecast.free < 0 && input.forecast.income.expected > 0) out.push({ id: "free-negative", tone: "warning", title: "Este mes gastas más de lo que ingresas", detail: `Previsión: ${money(input.forecast.free)} tras gastos, metas y compras planeadas.`, href: "/payroll" });

  if (input.monthlyExpenses > 0) {
    const months = input.liquidCash / input.monthlyExpenses;
    if (months < 3) out.push({ id: "emergency-low", tone: "warning", title: "Fondo de emergencia corto", detail: `Tu liquidez cubre ${months.toFixed(1)} meses de gastos. Lo habitual es tener entre 3 y 6.`, href: "/savings" });
    else if (months > 12) out.push({ id: "cash-idle", tone: "info", title: "Mucha liquidez parada", detail: `Tienes ${months.toFixed(0)} meses de gastos en efectivo; la inflación se lo come. Valora invertir parte o usar una cuenta remunerada.`, href: "/fire" });
  }

  for (const g of input.goals) {
    if (g.done || !g.deadline) continue;
    const saved = input.goalSaved(g);
    const months = Math.max(1, diffMonths(monthOf(today), monthOf(g.deadline)));
    const need = requiredMonthly(saved, g.target, months, g.expectedReturn);
    if (saved < g.target && need > g.monthlyContribution * 1.05) {
      out.push({ id: `goal-${g.id}`, tone: "warning", title: `Meta «${g.name}» va con retraso`, detail: `Necesitas ${money(need)}/mes para llegar a tiempo (aportas ${money(g.monthlyContribution)}).`, href: "/savings" });
    }
  }

  for (const p of input.purchases) {
    if (p.status !== "planned" || p.need) continue;
    const age = diffDays(p.createdAt.slice(0, 10), today);
    if (age >= 30 && p.saved >= p.price) out.push({ id: `purchase-ready-${p.id}`, tone: "success", title: `Ya puedes comprar «${p.name}»`, detail: "Pasaron los 30 días de reflexión y lo tienes ahorrado. ¿Lo sigues queriendo?", href: "/purchases" });
    else if (purchaseMonthly(p, today) > Math.max(0, input.forecast.free) && input.forecast.income.expected > 0 && p.priority === 1) {
      out.push({ id: `purchase-tight-${p.id}`, tone: "info", title: `«${p.name}» no cabe en el plan actual`, detail: `Requiere ${money(purchaseMonthly(p, today))}/mes y tu margen libre es ${money(Math.max(0, input.forecast.free))}.`, href: "/purchases" });
    }
  }

  const drift = input.rebalance.filter((r) => Math.abs(r.drift) >= 5);
  if (drift.length) out.push({ id: "rebalance", tone: "info", title: "Tu cartera se ha desviado del objetivo", detail: drift.map((r) => `${r.holding.name} ${r.drift > 0 ? "+" : ""}${r.drift.toFixed(1)} pp`).join(" · "), href: "/investments" });

  const order: Record<AlertTone, number> = { danger: 0, warning: 1, success: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
