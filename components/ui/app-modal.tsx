"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

export interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "cover" | "full";
  dismissable?: boolean;
}

// Standard dialog chrome. Built on the native <dialog> element: the browser traps focus, makes the
// page inert, closes on Escape and restores focus, so there is nothing to get wrong.
export function AppModal({ isOpen, onOpenChange, title, children, footer, size = "md", dismissable = true }: AppModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !isOpen) return;
    if (!dialog.open) dialog.showModal();
    // showModal() focuses the first focusable element; React's autoFocus ran before it, so re-apply.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const sizeClass = size === "md" ? "" : `size-${size === "cover" ? "full" : size}`;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn("modal", sizeClass)}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onOpenChange(false);
      }}
      onMouseDown={(e) => {
        if (dismissable && e.target === ref.current) onOpenChange(false);
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-xl font-extrabold leading-tight">
          {title}
        </h2>
        {dismissable && (
          <button type="button" aria-label={"Cerrar"} onClick={() => onOpenChange(false)} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-secondary hover:text-foreground">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
    </dialog>
  );
}
