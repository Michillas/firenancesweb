"use client";

import { ArrowLeftRight, Download, EyeOff, Plus, Search, Sparkles, Tag, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Amount, Button, Card, CheckboxField, EmptyState, MenuButton, PageHeader, SelectInput, Stat, confirmAction, toast } from "@/components/ui";
import type { Transaction } from "@/core/domain/finance";
import { addMonthKey, firstDay, lastDay, monthOf } from "@/core/logic/dates";
import { toBase } from "@/core/logic/money";
import { getPlatform } from "@/core/platform";
import { cn } from "@/lib/cn";
import { formatDay, cap } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useAccounts, useCategories, useCategoryMap, useFx, useMoney, useTransactions } from "@/store/selectors";
import { transactions } from "@/store/stores";
import { openTransaction } from "@/store/ui";

const PAGE = 120;

type Period = "month" | "prev" | "3m" | "year" | "all";

export function TransactionsScreen() {
  const today = useToday();
  const money = useMoney();
  const fx = useFx();
  const all = useTransactions();
  const catMap = useCategoryMap();
  const cats = useCategories();
  const accounts = useAccounts({ includeArchived: true });
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("3m");
  const [kind, setKind] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const range = useMemo((): [string, string] => {
    const m = monthOf(today);
    if (period === "month") return [firstDay(m), lastDay(m)];
    if (period === "prev") return [firstDay(addMonthKey(m, -1)), lastDay(addMonthKey(m, -1))];
    if (period === "3m") return [firstDay(addMonthKey(m, -2)), lastDay(m)];
    if (period === "year") return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`];
    return ["0000-01-01", "9999-12-31"];
  }, [period, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (t.date < range[0] || t.date > range[1]) return false;
      if (kind && t.kind !== kind) return false;
      if (category && (category === "none" ? t.categoryId !== null || t.kind === "transfer" : t.categoryId !== category)) return false;
      if (account && t.accountId !== account && t.toAccountId !== account) return false;
      if (q) {
        const hay = `${t.description} ${t.merchant} ${t.notes} ${t.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, range, kind, category, account, query]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.excluded) continue;
      const v = toBase(t.amount, t.currency, fx);
      if (t.kind === "income") income += v;
      else if (t.kind === "expense") expense += v;
    }
    return { income, expense, net: income - expense };
  }, [filtered, fx]);

  const groups = useMemo(() => {
    const out: { date: string; items: Transaction[] }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last?.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [filtered, limit]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkCategory = (categoryId: string | null) => {
    for (const id of selected) {
      const t = transactions.get(id);
      if (t && t.kind !== "transfer") transactions.update(id, { categoryId });
    }
    toast.success(`${selected.size} movimientos actualizados`);
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    if (!(await confirmAction({ title: `¿Eliminar ${selected.size} movimientos?`, danger: true, confirmLabel: "Eliminar" }))) return;
    for (const id of selected) transactions.remove(id);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const header = "fecha;tipo;importe;moneda;concepto;categoría;cuenta;notas";
    const rows = filtered.map((t) => [t.date, t.kind, String(t.amount).replace(".", ","), t.currency, t.description, t.categoryId ? catMap.get(t.categoryId)?.name ?? "" : "", t.accountId ? accMap.get(t.accountId)?.name ?? "" : "", t.notes].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"));
    void getPlatform().saveFile(`firenances-movimientos-${today}.csv`, new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv" }));
  };

  return (
    <>
      <PageHeader
        title="Movimientos"
        description="Todos tus gastos, ingresos y traspasos. Añádelos a mano, impórtalos desde un CSV o pásale el extracto a la IA."
        actions={
          <>
            <Link href="/import" className="btn btn-secondary">
              <Sparkles size={16} aria-hidden="true" /> Importar
            </Link>
            <Button onPress={() => openTransaction()}>
              <Plus size={16} aria-hidden="true" /> Añadir
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="relative flex-1">
            <span className="sr-only">Buscar</span>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-10" placeholder="Buscar por concepto, comercio o importe" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[44rem]">
            <SelectInput label="Periodo" hideLabel value={period} onChange={(v) => setPeriod((v as Period) ?? "3m")} options={[{ id: "month", label: "Este mes" }, { id: "prev", label: "Mes anterior" }, { id: "3m", label: "Últimos 3 meses" }, { id: "year", label: "Este año" }, { id: "all", label: "Todo" }]} />
            <SelectInput label="Tipo" hideLabel value={kind} onChange={setKind} emptyLabel="Todos los tipos" options={[{ id: "expense", label: "Gastos" }, { id: "income", label: "Ingresos" }, { id: "transfer", label: "Traspasos" }]} />
            <SelectInput label="Categoría" hideLabel value={category} onChange={setCategory} emptyLabel="Todas las categorías" options={[{ id: "none", label: "Sin categoría" }, ...cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))]} />
            <SelectInput label="Cuenta" hideLabel value={account} onChange={setAccount} emptyLabel="Todas las cuentas" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
          <Stat label="Ingresos" value={money(totals.income)} />
          <Stat label="Gastos" value={money(totals.expense)} />
          <Stat label="Balance" value={<span className={totals.net >= 0 ? "text-success" : "text-danger"}>{money(totals.net, { sign: true })}</span>} />
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-[calc(var(--header-h)+0.5rem)] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-overlay p-2 shadow-lift lg:top-2">
          <span className="px-2 text-sm font-bold">{selected.size} seleccionados</span>
          <MenuButton label="Cambiar categoría" triggerClassName="btn btn-secondary btn-sm" trigger={<><Tag size={15} aria-hidden="true" /> Categoría</>} items={[{ id: "none", label: "Sin categoría", onSelect: () => bulkCategory(null) }, ...cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}`, onSelect: () => bulkCategory(c.id) }))]} />
          <Button size="sm" variant="secondary" onPress={() => { for (const id of selected) transactions.update(id, { excluded: true }); setSelected(new Set()); }}>
            <EyeOff size={15} aria-hidden="true" /> Excluir
          </Button>
          <Button size="sm" variant="danger" onPress={bulkDelete}>
            <Trash2 size={15} aria-hidden="true" /> Eliminar
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onPress={() => setSelected(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={all.length ? "Nada con estos filtros" : "Aún no hay movimientos"}
          description={all.length ? "Prueba con otro periodo o quita filtros." : "Empieza añadiendo un gasto o importa tu extracto bancario (CSV o PDF) y deja que la IA lo clasifique."}
          action={
            !all.length && (
              <div className="flex gap-2">
                <Button onPress={() => openTransaction()}>Añadir movimiento</Button>
                <Link href="/import" className="btn btn-secondary">
                  <Upload size={16} aria-hidden="true" /> Importar extracto
                </Link>
              </div>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {filtered.length} movimientos · {period === "all" ? "todo el historial" : `${formatDay(range[0], "long")} – ${formatDay(range[1], "long")}`}
            </span>
            <Button size="sm" variant="ghost" onPress={exportCsv}>
              <Download size={15} aria-hidden="true" /> Exportar CSV
            </Button>
          </div>
          {groups.map((g) => (
            <section key={g.date} aria-label={formatDay(g.date, "full")}>
              <h3 className="mb-1.5 px-1 text-xs font-extrabold uppercase tracking-wider text-muted">{g.date === today ? "Hoy" : cap(formatDay(g.date, "full"))}</h3>
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {g.items.map((t) => {
                  const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
                  const a = t.accountId ? accMap.get(t.accountId) : undefined;
                  const to = t.toAccountId ? accMap.get(t.toAccountId) : undefined;
                  return (
                    <li key={t.id} className={cn("flex items-center gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0", t.excluded && "opacity-60", selected.has(t.id) && "bg-accent/[0.06]")}>
                      <CheckboxField label={`Seleccionar ${t.description}`} hideLabel isSelected={selected.has(t.id)} onChange={() => toggle(t.id)} />
                      <button type="button" onClick={() => openTransaction({ id: t.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-secondary text-xl">
                          {t.kind === "transfer" ? "↔️" : (c?.emoji ?? "❔")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{t.description || "(sin concepto)"}</span>
                          <span className="block truncate text-sm text-muted">
                            {t.kind === "transfer" ? `${a?.name ?? "?"} → ${to?.name ?? "?"}` : [c?.name ?? "Sin categoría", a?.name].filter(Boolean).join(" · ")}
                            {t.source === "recurring" && " · recurrente"}
                            {t.excluded && " · excluido"}
                          </span>
                        </span>
                        <Amount value={t.amount} kind={t.kind} money={money} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {filtered.length > limit && (
            <Button variant="secondary" className="self-center" onPress={() => setLimit((l) => l + PAGE)}>
              Ver más ({filtered.length - limit} restantes)
            </Button>
          )}
        </div>
      )}
    </>
  );
}
