"use client";

import { Ellipsis, Eye, EyeOff, PanelLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MenuButton } from "@/components/ui";
import { addDays } from "@/core/logic/dates";
import { fireNumbers } from "@/core/logic/fire";
import { cn } from "@/lib/cn";
import { formatPct } from "@/lib/format";
import { useLocalValue } from "@/lib/use-local-value";
import { useToday } from "@/lib/use-today";
import { useDoc } from "@/store/create-doc-store";
import { startLive } from "@/store/live";
import { useAgenda, useAnnualExpenses, useMoney, useNetWorth } from "@/store/selectors";
import { plan, settings } from "@/store/stores";
import { LogoMark } from "./logo";
import { NAV_GROUPS, NAV_ITEMS, isActive } from "./nav-items";

const COLLAPSE_KEY = "firenances:nav-collapsed";

function ProfileInitial() {
  const name = useDoc(settings).displayName.trim() || "Tu perfil";
  return <span aria-hidden="true">{name[0]!.toUpperCase()}</span>;
}

function PrivacyToggle() {
  const on = useDoc(settings).privacyMode;
  const label = on ? "Mostrar importes" : "Ocultar importes";
  return (
    <button type="button" onClick={() => settings.patch({ privacyMode: !on })} aria-pressed={on} title={label} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-tertiary hover:text-foreground">
      {on ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}

// Profile card at the bottom-left: it is the way into Settings.
function ProfileCard({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const s = useDoc(settings);
  const name = s.displayName.trim() || "Tu perfil";
  const active = isActive(pathname, "/settings");
  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border p-2", active ? "nav-active" : "border-border bg-surface", collapsed && "flex-col")}>
      <Link href="/settings" aria-current={active ? "page" : undefined} title={collapsed ? "Perfil y ajustes" : undefined} className="flex min-w-0 flex-1 items-center gap-2.5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface-secondary text-sm font-medium">
          {name[0]!.toUpperCase()}
        </span>
        {collapsed ? (
          <span className="sr-only">Perfil y ajustes</span>
        ) : (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm">{name}</span>
            <span className="block truncate text-xs text-muted">Perfil y ajustes</span>
          </span>
        )}
      </Link>
      <PrivacyToggle />
    </div>
  );
}

// Half-circle gauge at the foot of the sidebar (reference "480 / 500"): progress to FIRE.
function FireGauge() {
  const nw = useNetWorth();
  const expenses = useAnnualExpenses();
  const p = useDoc(plan);
  const money = useMoney();
  const target = fireNumbers(expenses.annual, p.fire).fire;
  const ratio = target > 0 ? Math.min(1, Math.max(0, nw.fireAssets / target)) : 0;
  const r = 70;
  const arc = Math.PI * r;
  return (
    <Link href="/fire" className="relative block overflow-hidden rounded-2xl px-2 pb-1 pt-3 text-center hover:bg-surface-secondary">
      <svg viewBox="0 0 160 88" className="mx-auto w-full max-w-[13rem]" aria-hidden="true">
        <path d="M10 80 A70 70 0 0 1 150 80" fill="none" stroke="var(--surface-tertiary)" strokeWidth="2" />
        <path d="M10 80 A70 70 0 0 1 150 80" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={arc} strokeDashoffset={arc * (1 - ratio)} style={{ filter: "drop-shadow(0 0 6px var(--accent))" }} />
      </svg>
      <div className="-mt-9">
        <p className="text-sm tabular-nums">
          {money(nw.fireAssets, { compact: true })} <span className="text-muted">/ {target > 0 ? money(target, { compact: true }) : "—"}</span>
        </p>
        <p className="text-xs text-muted">{target > 0 ? `${formatPct(ratio * 100, { decimals: 0 })} del camino a FIRE` : "Configura tu plan FIRE"}</p>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const today = useToday();
  const [collapsedValue, setCollapsedValue] = useLocalValue(COLLAPSE_KEY, "0");
  const collapsed = collapsedValue === "1";
  const toggle = () => setCollapsedValue(collapsed ? "0" : "1");
  const [query, setQuery] = useState("");
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const secondaryActive = secondary.some((i) => isActive(pathname, i.href));
  const soon = useAgenda(today, addDays(today, 7));

  // Small counters next to nav items (reference "● 3" badges).
  const badges = useMemo<Record<string, number>>(
    () => ({
      "/subscriptions": soon.filter((a) => a.kind === "charge" || a.kind === "trial").length,
      "/calendar": soon.filter((a) => a.kind === "tax" || a.kind === "market" || a.kind === "custom").length,
    }),
    [soon],
  );

  // Real-time prices for the whole session (crypto stream + exchange-hours polling).
  useEffect(() => startLive(), []);

  const q = query.trim().toLowerCase();
  const visible = q ? NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(q)) : NAV_ITEMS;

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>

      <aside aria-label="Navegación principal" className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 px-3 py-5 transition-[width] duration-200 lg:flex", collapsed ? "w-[84px]" : "w-[17rem]")}>
        <div className={cn("flex items-center gap-3 px-1", collapsed && "flex-col")}>
          <Link href="/" aria-label="FireNances" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface">
              <LogoMark className="size-6" />
            </span>
            {!collapsed && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-medium">FireNances®</span>
                <span className="block truncate text-sm text-muted">Finanzas personales</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={toggle} aria-label={collapsed ? "Expandir menú" : "Contraer menú"} title={collapsed ? "Expandir menú" : "Contraer menú"} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground">
            <PanelLeft size={17} aria-hidden="true" className={cn("transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {!collapsed && (
          <label className="relative block">
            <span className="sr-only">Buscar sección</span>
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visible[0]) {
                  router.push(visible[0].href);
                  setQuery("");
                }
              }}
              placeholder="Buscar"
              className="field min-h-10 pl-9"
            />
          </label>
        )}

        <nav aria-label="Secciones" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
          {NAV_GROUPS.map((group) => {
            const items = visible.filter((i) => i.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="flex flex-col gap-0.5">
                {!collapsed && <h2 className="px-1 pb-1 text-[0.95rem] font-medium">{group.label}</h2>}
                {items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  const badge = badges[href] ?? 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn("flex items-center gap-3 rounded-xl border px-2.5 py-2 text-[0.93rem] transition-colors", collapsed && "justify-center px-0", active ? "nav-active text-foreground" : "border-transparent text-muted hover:text-foreground")}
                    >
                      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                      {collapsed ? <span className="sr-only">{label}</span> : <span className="min-w-0 flex-1 truncate">{label}</span>}
                      {!collapsed && badge > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-xs tabular-nums text-accent">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" />
                          {badge}
                          <span className="sr-only">próximos</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="hidden [@media(min-height:1000px)]:block">
            <FireGauge />
          </div>
        )}
        <ProfileCard collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:py-3 lg:pr-3">
        <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/" aria-label="FireNances" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-surface">
              <LogoMark className="size-5" />
            </span>
            <span className="font-medium">FireNances</span>
          </Link>
          <div className="flex items-center gap-1">
            <PrivacyToggle />
            <Link href="/settings" aria-label="Perfil y ajustes" className="grid size-9 place-items-center rounded-xl border border-border bg-surface text-sm font-medium">
              <ProfileInitial />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pb-28 pt-5 outline-none lg:rounded-[1.75rem] lg:border lg:border-border lg:bg-surface/40 lg:px-8 lg:pb-10 lg:pt-6">
          <div className="mx-auto w-full max-w-[96rem]">{children}</div>
        </main>
      </div>

      <nav aria-label="Navegación principal" className="fixed inset-x-3 bottom-3 z-40 rounded-[1.4rem] border border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-lift backdrop-blur-xl lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[3.6rem] flex-col items-center justify-center gap-0.5 text-center text-[11px] leading-tight", active ? "text-accent" : "text-muted")}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  {label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <MenuButton
              label="Más"
              placement="top"
              triggerClassName={cn("flex min-h-[3.6rem] w-full flex-col items-center justify-center gap-0.5 text-[11px]", secondaryActive ? "text-accent" : "text-muted")}
              trigger={
                <>
                  <Ellipsis size={20} aria-hidden="true" />
                  Más
                </>
              }
              items={secondary.map(({ href, label, icon }) => ({ id: href, label, icon, onSelect: () => router.push(href) }))}
            />
          </li>
        </ul>
      </nav>
    </div>
  );
}
