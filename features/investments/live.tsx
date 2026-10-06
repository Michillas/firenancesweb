"use client";

import type { ReactNode } from "react";
import type { Quote } from "@/core/domain/market";
import { cn } from "@/lib/cn";
import { useLive } from "@/store/live";

// Re-mounts on every quote update so the flash animation replays in the tick's direction.
export function LiveValue({ quote, children, className }: { quote: Quote | undefined; children: ReactNode; className?: string }) {
  return (
    <span key={quote?.updatedAt ?? "none"} className={cn("inline-block px-0.5", quote?.live && quote.tick === "up" && "flash-up", quote?.live && quote.tick === "down" && "flash-down", className)}>
      {children}
    </span>
  );
}

// "En vivo" when at least one feed is streaming or a venue you hold is trading; otherwise "Mercados cerrados".
export function LiveBadge({ className }: { className?: string }) {
  const crypto = useLive((s) => s.crypto);
  const open = useLive((s) => s.open);
  const delayed = useLive((s) => s.delayed);
  const venues = [...(crypto === "live" ? ["cripto"] : []), ...open];
  const live = venues.length > 0;
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold", className)} title={live ? `Precios actualizándose: ${venues.join(", ")}${delayed ? ". Tokio, Estocolmo y otras bolsas con datos gratuitos llevan ~15 min de retraso." : ""}` : "Mercados cerrados: últimos precios conocidos"}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", live ? "live-dot bg-success" : "bg-muted")} />
      {live ? `En vivo · ${venues.join(", ")}${delayed ? " (algunas ~15 min)" : ""}` : "Mercados cerrados"}
    </span>
  );
}
