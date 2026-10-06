import type { Cycle, Recurring } from "../domain/finance";
import { addDays, addMonths, diffDays, diffMonths, type DayKey } from "./dates";

const CYCLE_MONTHS: Record<Exclude<Cycle, "weekly">, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

type Schedule = Pick<Recurring, "cycle" | "every" | "startDate" | "endDate">;

// Every charge date of `r` within [from, to]. Each date is computed from the start date
// (not from the previous charge), so a 31st never decays into the 28th after February.
export function occurrences(r: Schedule, from: DayKey, to: DayKey): DayKey[] {
  if (to < r.startDate || from > to) return [];
  const last = r.endDate && r.endDate < to ? r.endDate : to;
  const out: DayKey[] = [];
  const every = Math.max(1, r.every);
  if (r.cycle === "weekly") {
    const step = 7 * every;
    let k = Math.max(0, Math.floor(diffDays(r.startDate, from) / step) - 1);
    for (let d = addDays(r.startDate, k * step); d <= last; d = addDays(r.startDate, ++k * step)) {
      if (d >= from) out.push(d);
    }
    return out;
  }
  const step = CYCLE_MONTHS[r.cycle] * every;
  let k = Math.max(0, Math.floor(diffMonths(r.startDate.slice(0, 7), from.slice(0, 7)) / step) - 1);
  for (let d = addMonths(r.startDate, k * step); d <= last; d = addMonths(r.startDate, ++k * step)) {
    if (d >= from) out.push(d);
  }
  return out;
}

export function nextOccurrence(r: Schedule, from: DayKey): DayKey | null {
  const horizon = r.cycle === "weekly" ? addDays(from, 7 * Math.max(1, r.every)) : addMonths(from, CYCLE_MONTHS[r.cycle] * Math.max(1, r.every));
  return occurrences(r, from, horizon)[0] ?? null;
}

const PER_MONTH: Record<Cycle, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12 };

// Average monthly cost, so a yearly subscription is comparable with a monthly one.
export function monthlyEquivalent(r: Pick<Recurring, "cycle" | "every" | "amount">): number {
  return (r.amount * PER_MONTH[r.cycle]) / Math.max(1, r.every);
}

export const yearlyEquivalent = (r: Pick<Recurring, "cycle" | "every" | "amount">) => monthlyEquivalent(r) * 12;

// Charge dates that already happened and are not turned into transactions yet.
// `notBefore` stops a subscription created today with a start date in 2019 from back-filling years.
export function pendingCharges(r: Recurring, today: DayKey, notBefore: DayKey): DayKey[] {
  if (!r.active || !r.autoLog) return [];
  const from = [r.loggedThrough ? addDays(r.loggedThrough, 1) : r.startDate, notBefore, r.trialUntil ? addDays(r.trialUntil, 1) : r.startDate].sort().at(-1)!;
  return occurrences(r, from, today);
}

export function isActiveOn(r: Pick<Recurring, "active" | "startDate" | "endDate">, day: DayKey): boolean {
  return r.active && r.startDate <= day && (!r.endDate || r.endDate >= day);
}
