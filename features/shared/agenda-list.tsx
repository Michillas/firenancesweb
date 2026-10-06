"use client";

import Link from "next/link";
import type { AgendaItem } from "@/core/logic/agenda";
import { diffDays } from "@/core/logic/dates";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useMoney } from "@/store/selectors";

export function whenLabel(date: string, today: string): string {
  const d = diffDays(today, date);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d > 1 && d < 7) return `En ${d} días`;
  if (d < 0 && d > -7) return `Hace ${-d} días`;
  return formatDay(date);
}

export function AgendaList({ items, empty, compact }: { items: AgendaItem[]; empty: string; compact?: boolean }) {
  const today = useToday();
  const money = useMoney();
  if (items.length === 0) return <p className="py-4 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={i.href} className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-secondary", i.done && "opacity-60")}>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-secondary text-lg">
              {i.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-bold", compact && "text-sm")}>{i.title}</span>
              <span className="block truncate text-xs font-semibold text-muted">
                {whenLabel(i.date, today)}
                {i.approximate && " · fecha aproximada"}
                {!compact && i.detail && ` · ${i.detail}`}
              </span>
            </span>
            {i.amount != null && <span className={cn("shrink-0 text-sm font-extrabold tabular-nums", i.direction === "in" && "text-success")}>{i.direction === "out" ? `−${money(i.amount)}` : i.direction === "in" ? `+${money(i.amount)}` : money(i.amount)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
