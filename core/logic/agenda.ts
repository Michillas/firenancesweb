import type { CalendarEvent, Goal, Holding, Purchase, Recurring } from "../domain/finance";
import type { Feed } from "../domain/market";
import type { Payroll } from "../domain/plan";
import { addMonthKey, dayInMonth, monthOf, type DayKey } from "./dates";
import { netForMonth } from "./payroll";
import { occurrences } from "./recurrence";
import { spanishTaxCalendar } from "./tax-calendar";

export type AgendaKind = "charge" | "income" | "payday" | "tax" | "market" | "purchase" | "goal" | "custom" | "trial";

export interface AgendaItem {
  id: string;
  date: DayKey;
  kind: AgendaKind;
  title: string;
  detail?: string;
  amount: number | null;
  // Money leaving (-) or arriving (+); null = informational.
  direction: "in" | "out" | null;
  href: string;
  emoji: string;
  approximate?: boolean;
  done?: boolean;
  sourceId?: string;
}

const MARKET_EMOJI: Record<string, string> = { earnings: "📊", ex_dividend: "✂️", dividend_payment: "💸", split: "🔀", other: "📌" };
const MARKET_LABEL: Record<string, string> = { earnings: "Resultados", ex_dividend: "Ex-dividendo", dividend_payment: "Pago de dividendo", split: "Split", other: "Evento" };

// Everything with a date, merged: recurring charges, payday, taxes, market events, deadlines.
export function buildAgenda(input: {
  from: DayKey;
  to: DayKey;
  recurring: readonly Recurring[];
  payroll: Payroll;
  purchases: readonly Purchase[];
  goals: readonly Goal[];
  events: readonly CalendarEvent[];
  holdings: readonly Holding[];
  feeds: readonly Feed[];
  tax: { enabled: boolean; selfEmployed: boolean };
}): AgendaItem[] {
  const { from, to } = input;
  const out: AgendaItem[] = [];
  const inRange = (d: DayKey | null | undefined): d is DayKey => Boolean(d && d >= from && d <= to);

  for (const r of input.recurring) {
    if (!r.active) continue;
    for (const date of occurrences(r, from, to)) {
      const trial = r.trialUntil && date <= r.trialUntil;
      if (trial) continue;
      out.push({ id: `rec-${r.id}-${date}`, date, kind: r.kind === "income" ? "income" : "charge", title: r.name, amount: r.amount, direction: r.kind === "income" ? "in" : "out", href: "/subscriptions", emoji: r.emoji, sourceId: r.id });
    }
    if (inRange(r.trialUntil)) out.push({ id: `trial-${r.id}`, date: r.trialUntil, kind: "trial", title: `Fin de la prueba: ${r.name}`, detail: "Cancela antes si no lo vas a usar.", amount: r.amount, direction: null, href: "/subscriptions", emoji: "⏳", sourceId: r.id });
  }

  if (input.payroll.grossAnnual > 0 || input.payroll.netMonthlyOverride != null) {
    for (let m = monthOf(from); m <= monthOf(to); m = addMonthKey(m, 1)) {
      const date = dayInMonth(m, input.payroll.payday);
      if (!inRange(date)) continue;
      const isExtra = input.payroll.payments === 14 && input.payroll.extraMonths.includes(Number(m.slice(5, 7)));
      out.push({ id: `pay-${m}`, date, kind: "payday", title: isExtra ? "Nómina + paga extra" : "Nómina", amount: netForMonth(input.payroll, m), direction: "in", href: "/payroll", emoji: "💼" });
    }
  }

  if (input.tax.enabled) {
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      for (const t of spanishTaxCalendar(y, { selfEmployed: input.tax.selfEmployed })) {
        if (inRange(t.date)) out.push({ id: `tax-${t.id}`, date: t.date, kind: "tax", title: t.title, detail: t.detail, amount: null, direction: null, href: "/calendar", emoji: "🧾", approximate: t.approximate });
      }
    }
  }

  const holdingById = new Map(input.holdings.map((h) => [h.id, h]));
  for (const f of input.feeds) {
    const h = holdingById.get(f.holdingId);
    if (!h || h.archived) continue;
    const seen = new Set<string>();
    for (const e of f.events) {
      const key = `${e.kind}-${e.date}`;
      if (!inRange(e.date) || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `mkt-${h.id}-${key}`, date: e.date, kind: "market", title: `${MARKET_LABEL[e.kind]} · ${h.name}`, detail: e.amount != null ? `Importe por acción: ${e.amount}` : undefined, amount: e.kind === "dividend_payment" && e.amount != null && h.units > 0 ? e.amount * h.units : null, direction: e.kind === "dividend_payment" ? "in" : null, href: `/investments/${h.id}`, emoji: MARKET_EMOJI[e.kind], approximate: e.estimated, sourceId: h.id });
    }
  }

  for (const p of input.purchases) {
    if (p.status === "planned" && inRange(p.targetDate)) out.push({ id: `pur-${p.id}`, date: p.targetDate, kind: "purchase", title: `Compra prevista: ${p.name}`, amount: p.price, direction: "out", href: "/purchases", emoji: p.emoji, sourceId: p.id });
  }
  for (const g of input.goals) {
    if (!g.done && inRange(g.deadline)) out.push({ id: `goal-${g.id}`, date: g.deadline, kind: "goal", title: `Fecha objetivo: ${g.name}`, amount: g.target, direction: null, href: "/savings", emoji: g.emoji, sourceId: g.id });
  }
  for (const e of input.events) {
    if (inRange(e.date)) out.push({ id: `evt-${e.id}`, date: e.date, kind: e.kind === "tax" ? "tax" : "custom", title: e.title, detail: e.notes || undefined, amount: e.amount, direction: e.amount != null ? "out" : null, href: "/calendar", emoji: e.kind === "tax" ? "🧾" : "📌", done: e.done, sourceId: e.id });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
