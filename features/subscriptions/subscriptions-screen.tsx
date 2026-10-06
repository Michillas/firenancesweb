"use client";

import { ExternalLink, Plus, Repeat, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, Chip, EmojiBadge, EmptyState, PageHeader, SectionTitle, Segmented, Stat } from "@/components/ui";
import type { Recurring } from "@/core/domain/finance";
import { addDays, diffDays } from "@/core/logic/dates";
import { detectRecurring } from "@/core/logic/detect-recurring";
import { toBase } from "@/core/logic/money";
import { monthlyEquivalent, nextOccurrence } from "@/core/logic/recurrence";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useAgenda, useCategoryMap, useFx, useMoney } from "@/store/selectors";
import { recurring, transactions } from "@/store/stores";
import { AgendaList, whenLabel } from "../shared/agenda-list";
import { CYCLE_LABEL, CYCLE_SHORT, RecurringModal, type RecurringDraft } from "./recurring-modal";

type Tab = "subscription" | "bill" | "income";

export function SubscriptionsScreen() {
  const today = useToday();
  const money = useMoney();
  const fx = useFx();
  const items = useCollection(recurring);
  const txs = useCollection(transactions);
  const catMap = useCategoryMap();
  const [tab, setTab] = useState<Tab>("subscription");
  const [editing, setEditing] = useState<{ item: Recurring | null; draft?: RecurringDraft } | null>(null);
  const agenda = useAgenda(today, addDays(today, 30));
  const upcoming = agenda.filter((a) => a.kind === "charge" || a.kind === "trial" || a.kind === "income");

  const totals = useMemo(() => {
    const t = { subscription: 0, bill: 0, income: 0 };
    for (const r of items) if (r.active) t[r.kind] += toBase(monthlyEquivalent(r), r.currency, fx);
    return t;
  }, [items, fx]);

  const suggestions = useMemo(() => detectRecurring(txs, items, today), [txs, items, today]);
  const list = items.filter((r) => r.kind === tab).sort((a, b) => Number(b.active) - Number(a.active) || (nextOccurrence(a, today) ?? "9").localeCompare(nextOccurrence(b, today) ?? "9"));

  return (
    <>
      <PageHeader
        title="Suscripciones y recibos"
        description="Todo lo que se cobra solo: cuándo, cuánto y cuánto suma al año. Los cobros se registran automáticamente y entran en tus previsiones."
        actions={
          <Button onPress={() => setEditing({ item: null, draft: { kind: tab } })}>
            <Plus size={16} aria-hidden="true" /> Añadir
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Suscripciones" value={`${money(totals.subscription)}/mes`} hint={`${money(totals.subscription * 12)} al año`} />
            <Stat label="Recibos fijos" value={`${money(totals.bill)}/mes`} hint={`${money(totals.bill * 12)} al año`} />
            <Stat label="Total cargos fijos" value={`${money(totals.subscription + totals.bill)}/mes`} hint={`${items.filter((r) => r.active && r.kind !== "income").length} activos`} />
            <Stat label="Ingresos recurrentes" value={`${money(totals.income)}/mes`} />
          </div>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <Segmented label="Tipo" value={tab} onChange={setTab} options={[{ id: "subscription", label: "Suscripciones" }, { id: "bill", label: "Recibos" }, { id: "income", label: "Ingresos" }]} className="self-start" />
          {list.length === 0 ? (
            <EmptyState icon={Repeat} title="Nada por aquí" description={tab === "subscription" ? "Netflix, Spotify, iCloud, el gimnasio… Añádelas y sabrás cuánto te cuestan al año." : tab === "bill" ? "Alquiler, hipoteca, luz, internet, seguros…" : "Ingresos que llegan solos (alquiler que cobras, pensión…). La nómina va en Nómina y previsión."} action={<Button onPress={() => setEditing({ item: null, draft: { kind: tab } })}>Añadir</Button>} />
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((r) => {
                const next = nextOccurrence(r, today);
                const inTrial = r.trialUntil && r.trialUntil >= today;
                const cat = r.categoryId ? catMap.get(r.categoryId) : undefined;
                return (
                  <li key={r.id} className={cn("flex items-center gap-3 rounded-2xl border border-border bg-surface p-3", !r.active && "opacity-60")}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing({ item: r })}>
                      <EmojiBadge emoji={r.emoji} color={r.color} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-extrabold">{r.name}</span>
                          {inTrial && <Chip size="sm" color="warning">Prueba hasta {formatDay(r.trialUntil!)}</Chip>}
                          {!r.active && <Chip size="sm">Pausada</Chip>}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {CYCLE_LABEL[r.cycle]}
                          {r.every > 1 ? ` (cada ${r.every})` : ""} · {r.active && next ? `próximo ${whenLabel(next, today).toLowerCase()}${whenLabel(next, today) === formatDay(next) ? "" : ` (${formatDay(next)})`}` : "sin próximos cobros"}
                          {cat && ` · ${cat.name}`}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-black tabular-nums">
                          {money(r.amount, { currency: r.currency })}/{CYCLE_SHORT[r.cycle]}
                        </span>
                        {r.cycle !== "monthly" && <span className="block text-xs text-muted">≈ {money(monthlyEquivalent(r))}/mes</span>}
                        {r.cycle === "monthly" && <span className="block text-xs text-muted">{money(r.amount * 12)}/año</span>}
                      </span>
                    </button>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm btn-icon" aria-label={`Gestionar ${r.name}`} title="Gestionar o cancelar">
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    )}
                    <label className="flex items-center" title={r.active ? "Pausar" : "Reactivar"}>
                      <span className="sr-only">{r.active ? `Pausar ${r.name}` : `Reactivar ${r.name}`}</span>
                      <input type="checkbox" role="switch" checked={r.active} onChange={(e) => recurring.update(r.id, { active: e.target.checked })} className="toggle" />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle>Próximos 30 días</SectionTitle>
            <AgendaList items={upcoming} empty="No hay cobros en los próximos 30 días." compact />
            {upcoming.length > 0 && (
              <p className="border-t border-border pt-2 text-sm font-bold">
                Total a pagar: {money(upcoming.filter((u) => u.direction === "out").reduce((n, u) => n + (u.amount ?? 0), 0))}
              </p>
            )}
          </Card>

          {suggestions.length > 0 && (
            <Card>
              <SectionTitle>
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={17} className="text-accent" aria-hidden="true" /> Detectadas en tus movimientos
                </span>
              </SectionTitle>
              <ul className="flex flex-col gap-2">
                {suggestions.slice(0, 6).map((s) => (
                  <li key={s.key} className="flex items-center gap-2 rounded-xl bg-surface-secondary p-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{s.name}</span>
                      <span className="block text-xs text-muted">
                        {money(s.amount)} · {CYCLE_LABEL[s.cycle].toLowerCase()} · {s.count} cargos · último hace {diffDays(s.lastDate, today)} d
                      </span>
                    </span>
                    <Button size="sm" variant="secondary" onPress={() => setEditing({ item: null, draft: { name: s.name, amount: s.amount, cycle: s.cycle, startDate: s.nextDate, categoryId: s.categoryId, accountId: s.accountId, kind: "subscription" } })}>
                      Añadir
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionTitle>Consejo</SectionTitle>
            <p className="text-sm text-muted">Revisa las suscripciones cada trimestre. Si una no la has usado en el último mes, pausa o cancélala: {money(totals.subscription * 12)} al año invertidos al 7 % serían {money(totals.subscription * 12 * ((Math.pow(1.07, 10) - 1) / 0.07))} en 10 años.</p>
          </Card>
        </div>
      </div>

      {editing && <RecurringModal key={editing.item?.id ?? "new"} item={editing.item} draft={editing.draft} onClose={() => setEditing(null)} />}
    </>
  );
}
