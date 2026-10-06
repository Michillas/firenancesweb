"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Every form control is a real <label> + native element: free keyboard, screen-reader and
// mobile-keyboard support, and nothing to break when the design changes.
export function Field({ label, hint, htmlFor, className, hideLabel, children }: { hideLabel?: boolean; label: ReactNode; hint?: ReactNode; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={hideLabel ? "sr-only" : "text-sm font-bold"}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
  isRequired,
  className,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  isRequired?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <input id={id} className="field" type={type} value={value} placeholder={placeholder} required={isRequired} autoFocus={autoFocus} data-autofocus={autoFocus || undefined} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextAreaInput({ label, value, onChange, placeholder, rows = 3, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className}>
      <textarea id={id} className="field resize-y" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export interface Option {
  id: string;
  label: string;
}

// Native <select>: the most accessible dropdown there is. `emptyLabel` adds a "none" entry mapped to null.
export function SelectInput({ label, value, onChange, options, placeholder, emptyLabel, className, hideLabel }: { label: string; value: string | null | undefined; onChange: (value: string | null) => void; options: Option[]; placeholder?: string; emptyLabel?: string; className?: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <Field label={label} hideLabel={hideLabel} htmlFor={id} className={className}>
      <select id={id} className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        {(emptyLabel || placeholder) && (
          <option value="" disabled={!emptyLabel}>
            {emptyLabel ?? placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SwitchField({ label, isSelected, onChange, hint }: { label: string; isSelected: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={isSelected} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-surface-tertiary transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function CheckboxField({ label, isSelected, onChange, hideLabel, className }: { label: string; isSelected: boolean; onChange: (v: boolean) => void; hideLabel?: boolean; className?: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2", className)}>
      <input type="checkbox" checked={isSelected} onChange={(e) => onChange(e.target.checked)} className="check" aria-label={hideLabel ? label : undefined} />
      {!hideLabel && <span className="text-sm font-semibold">{label}</span>}
    </label>
  );
}

export function RangeField({ label, value, onChange, onCommit, min, max, step = 1, valueLabel, className }: { label: string; value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; min: number; max: number; step?: number; valueLabel?: string; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold">{label}</label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums text-accent">{valueLabel ?? value}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value))} onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))} className="h-2 w-full cursor-pointer accent-[var(--accent)]" />
    </div>
  );
}
