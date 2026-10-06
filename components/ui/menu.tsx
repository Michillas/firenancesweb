"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onSelect: () => void;
}

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

// Button + menu of actions. Arrow keys move, Enter selects, Escape closes and returns focus.
export function MenuButton({ label, trigger, items, placement = "bottom", align = "end", triggerClassName }: { label: string; trigger: ReactNode; items: MenuItem[]; placement?: "top" | "bottom"; align?: "start" | "end"; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(open, () => setOpen(false), root);

  const focusItem = (delta: number) => {
    const nodes = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = nodes.indexOf(document.activeElement as HTMLButtonElement);
    nodes[(i + delta + nodes.length) % nodes.length]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); focusItem(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); focusItem(-1); }
          }}
          ref={(node) => node?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()}
          className={cn("pop-in absolute z-50 min-w-52 rounded-2xl border border-border bg-overlay p-1.5 shadow-lift", placement === "top" ? "bottom-full mb-2" : "top-full mt-2", align === "end" ? "right-0" : "left-0")}
        >
          {items.map(({ id: itemId, label: text, icon: Icon, danger, onSelect }) => (
            <button
              key={itemId}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none", danger && "text-danger")}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Button that reveals a small panel of controls (reader appearance, filters).
export function Popover({ label, trigger, children, className, triggerClassName }: { label: string; trigger: ReactNode; children: ReactNode; className?: string; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(open, () => setOpen(false), root);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={label} className={cn("pop-in absolute right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-overlay p-4 shadow-lift", className)}>
          {children}
        </div>
      )}
    </div>
  );
}
