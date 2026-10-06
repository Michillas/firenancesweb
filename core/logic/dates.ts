// All calendar math works on local "day keys" (YYYY-MM-DD) and wall-clock "HH:mm" strings.
// Keys never encode a timezone, so events do not drift when the device timezone changes,
// and day arithmetic goes through UTC so DST transitions cannot add or drop a day.

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DayKey {
  return toKey(now);
}

export function parseKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function utcDay(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

export function diffDays(a: DayKey, b: DayKey): number {
  return utcDay(b) - utcDay(a);
}

export function addDays(key: DayKey, n: number): DayKey {
  const t = new Date((utcDay(key) + n) * 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMonths(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}

// 0 = Sunday ... 6 = Saturday
export function weekday(key: DayKey): number {
  return new Date(utcDay(key) * 86_400_000).getUTCDay();
}

export type WeekStart = 0 | 1;

export function startOfWeek(key: DayKey, weekStartsOn: WeekStart): DayKey {
  const offset = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: DayKey, weekStartsOn: WeekStart): DayKey[] {
  const start = startOfWeek(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(key: DayKey, weekStartsOn: WeekStart): DayKey[][] {
  const first = `${key.slice(0, 7)}-01`;
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)),
  );
}

export function sameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function rangeKeys(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function snapMinutes(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}

// Local wall-clock instant for a key + optional time. Used only for countdowns and sorting.
export function toLocalDate(key: DayKey, time?: string | null): Date {
  const d = parseKey(key);
  if (time) {
    const mins = timeToMinutes(time);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  }
  return d;
}

export function isoWeekKey(key: DayKey): string {
  // ISO-8601 week id, e.g. 2026-W40; used for per-week quotas (rest days, weekly quests).
  const d = new Date(utcDay(key) * 86_400_000);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

// ---- Months (YYYY-MM) ----------------------------------------------------------------------
export type MonthKey = string;

export const monthOf = (key: DayKey): MonthKey => key.slice(0, 7);

export function addMonthKey(month: MonthKey, n: number): MonthKey {
  return addMonths(`${month}-01`, n).slice(0, 7);
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const firstDay = (month: MonthKey): DayKey => `${month}-01`;
export const lastDay = (month: MonthKey): DayKey => `${month}-${pad(daysInMonth(month))}`;

// Months from `a` to `b` (positive when b is later).
export function diffMonths(a: MonthKey, b: MonthKey): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// The `n` months ending with `last` (inclusive), oldest first.
export function lastMonths(last: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonthKey(last, i - n + 1));
}

// Day key for day-of-month `day` in `month`, clamped to the month length (31 -> 28 in February).
export function dayInMonth(month: MonthKey, day: number): DayKey {
  return `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(month)))}`;
}
