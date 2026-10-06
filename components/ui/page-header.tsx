"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/components/shell/nav-items";
import { cn } from "@/lib/cn";

// Panel header strip (reference "Dashboard · Track and Learn about your assets"): section icon in a
// bordered tile, title and subtitle, with actions on the right. Bleeds to the panel edges on desktop.
// `flush` (default): the strip sits at the very top of the panel, cancelling the panel's top padding.
export function PageHeader({ title, description, actions, className, flush = true }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; flush?: boolean }) {
  const pathname = usePathname();
  const item = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  const Icon = item?.icon;
  return (
    <div className={cn("mb-6 flex flex-wrap items-center justify-between gap-3 lg:-mx-8 lg:border-b lg:border-border lg:px-8 lg:py-5", flush ? "lg:-mt-6" : "lg:pt-2", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span aria-hidden="true" className="hidden size-12 shrink-0 place-items-center rounded-2xl border border-border bg-surface sm:grid">
            <Icon size={22} strokeWidth={1.6} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
