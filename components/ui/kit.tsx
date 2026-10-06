"use client";

import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ---- Button ---------------------------------------------------------------------------------
// Chunky, tactile button in the prosperityweb style. `onPress` is kept as the click handler name
// so call sites read the same as before the HeroUI removal.
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "soft" | "success";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  isIconOnly?: boolean;
  isPending?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  // Kept for source compatibility; has no effect.
  slot?: string;
}

export function Button({ variant = "primary", size = "md", isIconOnly, isPending, isDisabled, onPress, className, children, type = "button", slot: _slot, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={isDisabled || isPending}
      onClick={onPress ? () => onPress() : undefined}
      className={cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, isIconOnly && "btn-icon", className)}
      {...rest}
    >
      {isPending && <Spinner size="sm" />}
      {children}
    </button>
  );
}

// ---- Card -----------------------------------------------------------------------------------
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("card", className)} {...rest}>
      {children}
    </section>
  );
}
Card.Header = function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3", className)} {...rest} />;
};
Card.Title = function CardTitle({ className, as: Tag = "h2", ...rest }: HTMLAttributes<HTMLHeadingElement> & { as?: ElementType }) {
  return <Tag className={cn("text-lg font-extrabold leading-tight", className)} {...rest} />;
};
Card.Description = function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...rest} />;
};
Card.Content = function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3", className)} {...rest} />;
};
Card.Footer = function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...rest} />;
};

// ---- Chip -----------------------------------------------------------------------------------
export function Chip({ color = "default", variant = "soft", size = "md", className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { color?: "default" | "accent" | "success" | "warning" | "danger"; variant?: "soft" | "primary" | "secondary"; size?: "sm" | "md" }) {
  return (
    <span className={cn("chip", size === "sm" && "chip-sm", variant === "primary" ? "chip-primary" : color !== "default" && `chip-${color}`, className)} {...rest}>
      {children}
    </span>
  );
}

// ---- Spinner / progress ---------------------------------------------------------------------
export function Spinner({ size = "md", className, label }: { size?: "sm" | "md" | "lg"; color?: string; className?: string; label?: string }) {
  return <span role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn("spinner", size !== "md" && `spinner-${size}`, className)} />;
}

const BAR_COLORS: Record<string, string> = { accent: "var(--accent)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", default: "var(--muted)" };

export function ProgressBar({ value, size = "md", className, color, "aria-label": ariaLabel }: { value: number; size?: "sm" | "md"; className?: string; color?: "accent" | "success" | "warning" | "danger" | "default"; "aria-label": string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cn("progress-track", size === "sm" && "sm", className)}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color ? BAR_COLORS[color] : undefined }} />
    </div>
  );
}

// Circular progress used for scores and daily targets.
export function ProgressRing({ ratio, size = 120, stroke = 10, className, barClassName, children }: { ratio: number; size?: number; stroke?: number; className?: string; barClassName?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-tertiary" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped)} className={cn("stroke-accent transition-[stroke-dashoffset] duration-500", barClassName)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ---- Segmented control (replaces toggle-button groups) --------------------------------------
export interface SegmentOption<T extends string> {
  id: T;
  label: ReactNode;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: { value: T; onChange: (id: T) => void; options: SegmentOption<T>[]; label: string; size?: "sm" | "md"; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-2xl border border-border bg-surface-secondary p-1", className)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.id)}
            className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors", size === "sm" ? "min-h-8 px-3 text-sm" : "min-h-10 px-4 text-sm", on ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Tabs -----------------------------------------------------------------------------------
export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (id: T) => void; tabs: { id: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === value);
              if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length]!.id);
              if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length]!.id);
            }}
            tabIndex={on ? 0 : -1}
            className={cn("-mb-0.5 whitespace-nowrap border-b-4 px-4 py-2.5 text-sm font-bold transition-colors", on ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}

// Several independent on/off toggles in one row (weekday picker).
export function MultiToggle({ values, onChange, options, label, className }: { values: string[]; onChange: (values: string[]) => void; options: { id: string; label: ReactNode; ariaLabel?: string }[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(on ? values.filter((v) => v !== o.id) : [...values, o.id])}
            className={cn("min-h-9 min-w-10 rounded-xl border px-3 text-sm font-bold transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-surface-secondary")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
