"use client";

import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal, Button, Card, MoneyInput, MultiToggle, PageHeader, SectionTitle, SelectInput, TextAreaInput, TextInput, confirmAction, toast } from "@/components/ui";
import type { CalendarEvent } from "@/core/domain/finance";
import type { AgendaItem, AgendaKind } from "@/core/logic/agenda";
import { addMonthKey, firstDay, lastDay, monthGrid, monthOf } from "@/core/logic/dates";
import { spanishTaxCalendar } from "@/core/logic/tax-calendar";
import { cn } from "@/lib/cn";
import { formatDay, formatMonth, cap } from "@/lib/format";
import { weekdayLabels } from "@/lib/weekdays";
import { useToday } from "@/lib/use-today";
import { useDoc } from "@/store/create-doc-store";
import { refreshAllFeeds } from "@/store/market";
import { useAgenda, useMoney } from "@/store/selectors";
import { events, settings } from "@/store/stores";
import { AgendaList } from "../shared/agenda-list";

const FILTERS: { id: string; label: string; kinds: AgendaKind[] }[] = [
  { id: "money", label: "Cobros y pagos", kinds: ["charge", "income", "payday", "trial"] },
  { id: "tax", label: "Fiscal", kinds: ["tax"] },
  { id: "market", label: "Mercados", kinds: ["market"] },
  { id: "plans", label: "Metas y compras", kinds: ["purchase", "goal"] },
  { id: "custom", label: "Mis eventos", kinds: ["custom"] },
];

const DOT: Record<AgendaKind, string> = { charge: "bg-danger", trial: "bg-warning", income: "bg-success", payday: "bg-success", tax: "bg-warning", market: "bg-accent", purchase: "bg-muted", goal: "bg-muted", custom: "bg-foreground" };

function EventModal({ event, date, onClose }: { event: CalendarEvent | null; date: string; onClose: () => void }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [day, setDay] = useState(event?.date ?? date);
  const [kind, setKind] = useState<CalendarEvent["kind"]>(event?.kind ?? "reminder");
  const [amount, setAmount] = useState<number | null>(event?.amount ?? null);
  const [notes, setNotes] = useState(event?.notes ?? "");
  const save = () => {
    const row = { title: title.trim(), date: day, kind, amount, notes };
    if (event) events.update(event.id, row);
    else events.create(row);
    onClose();
  };
  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={event ? "Editar evento" : "Nuevo evento"}
      size="sm"
      footer={
        <>
          {event && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={async () => { if (await confirmAction({ title: "¿Eliminar evento?", danger: true, confirmLabel: "Eliminar" })) { events.remove(event.id); onClose(); } }}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!title.trim()} onPress={save}>Guardar</Button>
        </>
      }
    >
      <TextInput label="Título" value={title} onChange={setTitle} placeholder="Pagar IBI, revisar hipoteca…" autoFocus />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Fecha" type="date" value={day} onChange={setDay} />
        <SelectInput label="Tipo" value={kind} onChange={(v) => v && setKind(v as CalendarEvent["kind"])} options={[{ id: "reminder", label: "Recordatorio" }, { id: "payment", label: "Pago puntual" }, { id: "tax", label: "Impuesto" }, { id: "market", label: "Mercados" }, { id: "other", label: "Otro" }]} />
      </div>
      <MoneyInput label="Importe (opcional)" value={amount} onChange={setAmount} />
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}

export function CalendarScreen() {
  const today = useToday();
  const money = useMoney();
  const s = useDoc(settings);
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);
  const [filters, setFilters] = useState<string[]>(FILTERS.map((f) => f.id));
  const [editing, setEditing] = useState<{ event: CalendarEvent | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const grid = useMemo(() => monthGrid(firstDay(month), s.weekStartsOn), [month, s.weekStartsOn]);
  const all = useAgenda(grid[0][0], grid[5][6]);
  const allowed = useMemo(() => new Set(FILTERS.filter((f) => filters.includes(f.id)).flatMap((f) => f.kinds)), [filters]);
  const items = useMemo(() => all.filter((i) => allowed.has(i.kind)), [all, allowed]);
  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);
  const monthItems = items.filter((i) => i.date >= firstDay(month) && i.date <= lastDay(month));
  const outflow = monthItems.filter((i) => i.direction === "out").reduce((n, i) => n + (i.amount ?? 0), 0);
  const inflow = monthItems.filter((i) => i.direction === "in").reduce((n, i) => n + (i.amount ?? 0), 0);
  const dayItems = byDay.get(selected) ?? [];
  const taxYear = useMemo(() => spanishTaxCalendar(Number(month.slice(0, 4)), { selfEmployed: s.selfEmployed }), [month, s.selfEmployed]);
  const labels = weekdayLabels(s.weekStartsOn);

  const refresh = async () => {
    setRefreshing(true);
    await refreshAllFeeds(true);
    setRefreshing(false);
    toast.success("Eventos de mercado actualizados");
  };

  return (
    <>
      <PageHeader
        title="Calendario financiero"
        description="Cobros, nómina, impuestos, resultados y dividendos de tu cartera, y tus fechas objetivo, en un solo sitio."
        actions={
          <>
            <Button variant="secondary" onPress={refresh} isPending={refreshing}>
              {!refreshing && <RefreshCw size={16} aria-hidden="true" />} Eventos de mercado
            </Button>
            <Button onPress={() => setEditing({ event: null })}>
              <Plus size={16} aria-hidden="true" /> Evento
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button isIconOnly size="sm" variant="ghost" aria-label="Mes anterior" onPress={() => setMonth(addMonthKey(month, -1))}>
                <ChevronLeft size={18} aria-hidden="true" />
              </Button>
              <h2 className="min-w-40 text-center text-lg font-extrabold">{cap(formatMonth(month))}</h2>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Mes siguiente" onPress={() => setMonth(addMonthKey(month, 1))}>
                <ChevronRight size={18} aria-hidden="true" />
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => { setMonth(monthOf(today)); setSelected(today); }}>
                Hoy
              </Button>
            </div>
            <p className="text-sm font-semibold text-muted">
              Entra <span className="text-success">{money(inflow)}</span> · sale <span className="text-danger">{money(outflow)}</span>
            </p>
          </div>
          <MultiToggle label="Mostrar" values={filters} onChange={setFilters} options={FILTERS.map((f) => ({ id: f.id, label: f.label }))} />
          <div role="grid" aria-label={`Calendario de ${formatMonth(month)}`} className="grid grid-cols-7 gap-1">
            {labels.map((l) => (
              <div key={l} role="columnheader" className="pb-1 text-center text-xs font-extrabold uppercase text-muted">
                {l}
              </div>
            ))}
            {grid.flat().map((day) => {
              const list = byDay.get(day) ?? [];
              const out = list.filter((i) => i.direction === "out").reduce((n, i) => n + (i.amount ?? 0), 0);
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={day === selected}
                  aria-label={`${formatDay(day, "full")}: ${list.length} eventos`}
                  onClick={() => setSelected(day)}
                  className={cn("flex min-h-[4.5rem] flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition-colors sm:min-h-24", day.slice(0, 7) !== month && "opacity-45", day === selected ? "border-accent bg-accent/10" : "border-transparent bg-surface-secondary/60 hover:bg-surface-secondary")}
                >
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs font-extrabold", day === today && "bg-accent text-accent-foreground")}>{Number(day.slice(8))}</span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex">
                    {list.slice(0, 2).map((i) => (
                      <span key={i.id} className="flex w-full items-center gap-1 truncate text-[0.7rem] font-semibold">
                        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[i.kind])} />
                        <span className="truncate">{i.title}</span>
                      </span>
                    ))}
                    {list.length > 2 && <span className="text-[0.7rem] font-bold text-muted">+{list.length - 2}</span>}
                  </span>
                  <span className="flex gap-0.5 sm:hidden" aria-hidden="true">
                    {list.slice(0, 4).map((i) => (
                      <span key={i.id} className={cn("size-1.5 rounded-full", DOT[i.kind])} />
                    ))}
                  </span>
                  {out > 0 && <span className="mt-auto hidden text-[0.7rem] font-bold tabular-nums text-danger sm:block">−{money(out, { compact: true })}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle action={<Button size="sm" variant="ghost" onPress={() => setEditing({ event: null })} aria-label="Añadir evento este día"><Plus size={16} aria-hidden="true" /></Button>}>
              <span>{cap(formatDay(selected, "full"))}</span>
            </SectionTitle>
            {dayItems.length === 0 ? (
              <p className="py-3 text-sm text-muted">Nada este día.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dayItems.map((i) => (
                  <li key={i.id} className="rounded-xl bg-surface-secondary p-2.5 text-sm">
                    <p className="flex items-center justify-between gap-2 font-bold">
                      <span>
                        {i.emoji} {i.title}
                      </span>
                      {i.amount != null && <span className={cn("tabular-nums", i.direction === "in" && "text-success")}>{i.direction === "out" ? "−" : i.direction === "in" ? "+" : ""}{money(i.amount)}</span>}
                    </p>
                    {i.detail && <p className="mt-0.5 text-muted">{i.detail}</p>}
                    {i.approximate && <p className="mt-0.5 text-xs font-semibold text-warning">Fecha aproximada</p>}
                    {i.kind === "custom" && i.sourceId && (
                      <button type="button" className="mt-1 text-xs font-bold text-accent" onClick={() => setEditing({ event: events.get(i.sourceId!) ?? null })}>
                        Editar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionTitle>Este mes</SectionTitle>
            <AgendaList items={monthItems} empty="Sin eventos este mes." compact />
          </Card>
          {s.showTaxCalendar && (
            <Card>
              <SectionTitle>Calendario fiscal {month.slice(0, 4)}</SectionTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {taxYear.map((t) => (
                  <li key={t.id} className={cn("rounded-xl p-2", t.date < today ? "opacity-55" : "bg-surface-secondary")}>
                    <p className="font-bold">
                      {formatDay(t.date, "long")} · {t.title}
                      {t.approximate && <span className="font-medium text-muted"> (aprox.)</span>}
                    </p>
                    <p className="text-muted">{t.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {editing && <EventModal key={editing.event?.id ?? "new"} event={editing.event} date={selected} onClose={() => setEditing(null)} />}
    </>
  );
}
