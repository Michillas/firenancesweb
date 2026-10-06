import { parseKey, type DayKey } from "@/core/logic/dates";

export const INTL = "es-ES";

const moneyCache = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, decimals: number, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${decimals}|${compact}`;
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(INTL, {
      style: "currency",
      currency,
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      notation: compact ? "compact" : "standard",
    });
    moneyCache.set(key, f);
  }
  return f;
}

export interface MoneyOptions {
  currency?: string;
  decimals?: number;
  compact?: boolean;
  // "+12,00 €" for gains.
  sign?: boolean;
  // Privacy mode: hide the digits.
  hidden?: boolean;
}

export function formatMoney(value: number, opts: MoneyOptions = {}): string {
  if (opts.hidden) return "•••• €".replace("€", symbolOf(opts.currency ?? "EUR"));
  const decimals = opts.decimals ?? (Math.abs(value) >= 10000 ? 0 : 2);
  const text = moneyFormat(opts.currency ?? "EUR", decimals, Boolean(opts.compact)).format(Number.isFinite(value) ? value : 0);
  return opts.sign && value > 0 ? `+${text}` : text;
}

export function symbolOf(currency: string): string {
  return moneyFormat(currency, 0, false).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat(INTL, { maximumFractionDigits: decimals }).format(value);
}

export function formatPct(value: number | null | undefined, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = `${new Intl.NumberFormat(INTL, { minimumFractionDigits: opts.decimals ?? 1, maximumFractionDigits: opts.decimals ?? 1 }).format(value)} %`;
  return opts.sign && value > 0 ? `+${text}` : text;
}

export function formatDay(key: DayKey, style: "short" | "long" | "full" | "month" = "short"): string {
  const d = parseKey(key);
  const opts: Intl.DateTimeFormatOptions =
    style === "short" ? { day: "numeric", month: "short" } : style === "long" ? { day: "numeric", month: "short", year: "numeric" } : style === "month" ? { month: "long", year: "numeric" } : { weekday: "long", day: "numeric", month: "long" };
  return new Intl.DateTimeFormat(INTL, opts).format(d);
}

export function formatMonth(month: string, style: "long" | "short" = "long"): string {
  const d = parseKey(`${month}-01`);
  return new Intl.DateTimeFormat(INTL, style === "long" ? { month: "long", year: "numeric" } : { month: "short" }).format(d);
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Intl.DateTimeFormat(INTL, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatYears(years: number | null): string {
  if (years == null) return "más de 100 años";
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} meses`;
  return `${formatNumber(years, 1)} años`;
}

// Number inputs accept "1.234,56" and "1234.56".
export function parseInputNumber(raw: string): number {
  const s = raw.replace(/[€$\s]/g, "");
  if (!s) return NaN;
  const normalized = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  return Number(normalized);
}

// Sentence case for dates ("martes, 6 de octubre" -> "Martes, 6 de octubre").
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
