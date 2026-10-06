"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { colorValue } from "@/lib/colors";
import { formatPct, parseInputNumber } from "@/lib/format";
import { Field } from "./fields";

// Headline number with an optional caption and delta (stat tile).
// "171.610,25 €" -> 171.610 + muted ",25 €" (reference style: cents in grey).
export function MoneyText({ value }: { value: string }) {
  const m = value.match(/^(.*?)([.,]\d{1,2})(\s?\S*)$/);
  if (!m) return <>{value}</>;
  return (
    <>
      {m[1]}
      <span className="text-muted">
        {m[2]}
        {m[3]}
      </span>
    </>
  );
}

export function Stat({ label, value, hint, delta, className, size = "md" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; delta?: ReactNode; className?: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("truncate font-normal tracking-tight tabular-nums", size === "lg" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl")}>{typeof value === "string" ? <MoneyText value={value} /> : value}</span>
      {(delta || hint) && (
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {delta}
          {hint}
        </span>
      )}
    </div>
  );
}

// Gain / loss with icon + sign so the meaning never depends on colour alone.
export function Delta({ value, pct, money, className, inverse }: { value?: number | null; pct?: number | null; money?: (n: number) => string; className?: string; inverse?: boolean }) {
  const raw = value ?? pct ?? 0;
  // "-0,0 %" is noise, not a loss.
  const basis = Math.abs(raw) < 0.05 ? 0 : raw;
  const good = inverse ? basis < 0 : basis > 0;
  const bad = inverse ? basis > 0 : basis < 0;
  const Icon = basis > 0 ? ArrowUpRight : basis < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap font-bold tabular-nums", good && "text-success", bad && "text-danger", !good && !bad && "text-muted", className)}>
      <Icon size={15} aria-hidden="true" />
      {value != null && money && <span>{money(value)}</span>}
      {pct != null && <span>{value != null && money ? ` (${formatPct(Math.abs(pct) < 0.05 ? 0 : pct, { sign: true })})` : formatPct(Math.abs(pct) < 0.05 ? 0 : pct, { sign: true })}</span>}
    </span>
  );
}

export function Amount({ value, money, kind, className }: { value: number; money: (n: number, o?: { sign?: boolean }) => string; kind?: "expense" | "income" | "transfer"; className?: string }) {
  const k = kind ?? (value < 0 ? "expense" : "income");
  const shown = k === "expense" ? -Math.abs(value) : Math.abs(value);
  return <span className={cn("font-extrabold tabular-nums", k === "income" && "text-success", k === "transfer" && "text-muted", className)}>{k === "transfer" ? money(Math.abs(value)) : money(shown, { sign: k === "income" })}</span>;
}

export function EmojiBadge({ emoji, color, size = "md", className }: { emoji: string; color?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "size-8 text-base rounded-xl" : size === "lg" ? "size-14 text-3xl rounded-2xl" : "size-10 text-xl rounded-2xl";
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center", dims, className)} style={{ background: `color-mix(in oklch, ${colorValue(color)} 18%, transparent)` }}>
      {emoji}
    </span>
  );
}

// Money input that accepts "1.234,56" or "1234.56". Keeps the raw text while typing.
export function MoneyInput({ label, value, onChange, hint, className, placeholder, suffix = "€", allowNegative, autoFocus }: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: ReactNode; className?: string; placeholder?: string; suffix?: string; allowNegative?: boolean; autoFocus?: boolean }) {
  const id = useId();
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <div className="relative">
        <input
          id={id}
          className="field pr-10 tabular-nums"
          inputMode="decimal"
          value={text}
          placeholder={placeholder ?? "0,00"}
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          onChange={(e) => {
            // Only digits, separators and a sign: letters never end up in a money field.
            const raw = e.target.value.replace(/[^\d.,\-\s]/g, "");
            setText(raw);
            if (!raw.trim()) return onChange(null);
            const n = parseInputNumber(raw);
            if (Number.isFinite(n)) onChange(allowNegative ? n : Math.abs(n));
          }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">{suffix}</span>
      </div>
    </Field>
  );
}

export function SectionTitle({ children, action, className, description }: { children: ReactNode; action?: ReactNode; className?: string; description?: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-2", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-medium leading-tight">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// Labelled bar used for budgets, goals and allocation lists (one hue, magnitude only).
export function Meter({ value, max, tone = "accent", label, className }: { value: number; max: number; tone?: "accent" | "success" | "warning" | "danger"; label: string; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { accent: "var(--accent)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className={cn("progress-track sm", className)}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return <p className="text-xs text-muted">{children ?? "Información educativa generada a partir de datos públicos y modelos de IA. No es asesoramiento financiero: contrasta antes de tomar decisiones."}</p>;
}
