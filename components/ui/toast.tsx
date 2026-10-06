"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "warning" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  description?: string;
}

const store = createStore<{ items: ToastItem[] }>(() => ({ items: [] }));
let nextId = 1;

function push(tone: Tone, message: string, options?: { description?: string }) {
  const id = nextId++;
  store.setState((s) => ({ items: [...s.items.slice(-3), { id, tone, message, description: options?.description }] }));
}

export const toast = {
  success: (message: string, options?: { description?: string }) => push("success", message, options),
  danger: (message: string, options?: { description?: string }) => push("danger", message, options),
  warning: (message: string, options?: { description?: string }) => push("warning", message, options),
  info: (message: string, options?: { description?: string }) => push("info", message, options),
};

const dismiss = (id: number) => store.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));

const ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info } as const;
const TONES: Record<Tone, string> = { success: "text-success", danger: "text-danger", warning: "text-warning", info: "text-accent" };

function ToastCard({ item, closeLabel }: { item: ToastItem; closeLabel: string }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.tone === "danger" ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [item.id, item.tone]);
  const Icon = ICONS[item.tone];
  return (
    <div role={item.tone === "danger" ? "alert" : "status"} className="pop-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-overlay p-3.5 shadow-lift">
      <Icon size={22} className={cn("mt-0.5 shrink-0", TONES[item.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{item.message}</p>
        {item.description && <p className="mt-0.5 text-sm text-muted">{item.description}</p>}
      </div>
      <button type="button" aria-label={closeLabel} onClick={() => dismiss(item.id)} className="rounded-lg p-1 text-muted hover:bg-surface-secondary">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastHost({ closeLabel }: { closeLabel: string }) {
  const items = useStore(store, (s) => s.items);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--nav-h)+0.75rem)] z-[200] flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-96 lg:bottom-24">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} closeLabel={closeLabel} />
      ))}
    </div>
  );
}
