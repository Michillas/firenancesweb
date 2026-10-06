"use client";

import { ChevronLeft, ChevronRight, Lightbulb, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { GroupedBars, TimeChart } from "@/components/charts";
import { Button, Card, Delta, Disclaimer, Meter, MoneyInput, PageHeader, SectionTitle, SelectInput, Spinner, Stat, toast } from "@/components/ui";
import type { SpendingReview } from "@/core/ai";
import { averageByCategory, budgetStatus, categoryByMonth, cumulativeDaily, monthlySummary, spendingByCategory, topMerchants } from "@/core/logic/cashflow";
import { addMonthKey, firstDay, lastDay, lastMonths, monthOf } from "@/core/logic/dates";
import { cn } from "@/lib/cn";
import { series } from "@/lib/colors";
import { formatMonth, formatPct, cap } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { reviewSpendingAction } from "@/store/actions/ai";
import { useCollection } from "@/store/create-collection-store";
import { useCategories, useCategoryMap, useForecast, useFx, useMoney } from "@/store/selectors";
import { categories, transactions } from "@/store/stores";

function BudgetEditor({ id, value }: { id: string; value: number | null }) {
  return <MoneyInput label="Presupuesto" value={value} onChange={(v) => categories.update(id, { monthlyBudget: v && v > 0 ? v : null })} className="w-36" />;
}

export function AnalysisScreen() {
  const today = useToday();
  const money = useMoney();
  const fx = useFx();
  const txs = useCollection(transactions);
  const catMap = useCategoryMap();
  const expenseCats = useCategories("expense");
  const allCats = useCollection(categories);
  // Early in the month the current one is mostly empty: start on the last complete month.
  const [month, setMonth] = useState(() => (Number(today.slice(8, 10)) < 10 ? addMonthKey(monthOf(today), -1) : monthOf(today)));
  const forecast = useForecast();
  const inProgress = month === monthOf(today);
  const [trendCat, setTrendCat] = useState<string | null>(null);
  const [review, setReview] = useState<SpendingReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [editBudgets, setEditBudgets] = useState(false);

  const months12 = useMemo(() => lastMonths(month, 12), [month]);
  const summary = useMemo(() => monthlySummary(txs, months12, catMap, fx), [txs, months12, catMap, fx]);
  const current = summary[summary.length - 1];
  const previous = summary[summary.length - 2];
  // For the month in progress, judge the split against the income you expect, not what arrived so far.
  const incomeBase = inProgress ? Math.max(current.income, forecast.income.expected) : current.income;
  const byCat = useMemo(() => spendingByCategory(txs, firstDay(month), lastDay(month), fx), [txs, month, fx]);
  const averages = useMemo(() => averageByCategory(txs, month, 3, fx), [txs, month, fx]);
  const merchants = useMemo(() => topMerchants(txs, firstDay(month), lastDay(month), fx, 8), [txs, month, fx]);
  const budgets = useMemo(() => budgetStatus(allCats, txs, month, today, fx), [allCats, txs, month, today, fx]);
  const cumulative = useMemo(() => {
    const now = cumulativeDaily(txs, month, fx);
    const prev = cumulativeDaily(txs, addMonthKey(month, -1), fx);
    const isCurrent = month === monthOf(today);
    const day = Number(today.slice(8, 10));
    return Array.from({ length: Math.max(now.length, prev.length) }, (_, i) => ({ day: String(i + 1), current: isCurrent && i + 1 > day ? null : (now[i] ?? null), previous: prev[i] ?? null }));
  }, [txs, month, fx, today]);
  const trend = useMemo(() => {
    const map = categoryByMonth(txs, months12, fx);
    return months12.map((m) => ({ month: m, value: trendCat ? (map.get(m)?.get(trendCat) ?? 0) : 0 }));
  }, [txs, months12, fx, trendCat]);

  const groups = useMemo(() => {
    const out = { needs: 0, wants: 0, savings: 0 };
    for (const r of byCat) {
      const g = r.categoryId ? catMap.get(r.categoryId)?.group : "wants";
      if (g === "needs" || g === "wants" || g === "savings") out[g] += r.total;
      else out.wants += r.total;
    }
    return out;
  }, [byCat, catMap]);
  const maxCat = Math.max(1, ...byCat.map((c) => c.total));

  const runReview = async () => {
    setReviewing(true);
    try {
      setReview(await reviewSpendingAction());
    } catch {
      toast.danger("La IA no ha respondido", { description: "Revisa tus proveedores en Ajustes → Inteligencia artificial." });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Gastos"
        description="En qué se va tu dinero, cómo evoluciona y dónde puedes recortar."
        actions={
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1">
            <Button isIconOnly size="sm" variant="ghost" aria-label="Mes anterior" onPress={() => setMonth(addMonthKey(month, -1))}>
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>
            <span className="min-w-36 text-center font-extrabold">{cap(formatMonth(month))}</span>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Mes siguiente" isDisabled={month >= monthOf(today)} onPress={() => setMonth(addMonthKey(month, 1))}>
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ingresos" value={money(current.income)} delta={!inProgress && previous ? <Delta pct={previous.income ? ((current.income - previous.income) / previous.income) * 100 : null} /> : undefined} hint={inProgress ? `mes en curso · previstos ${money(forecast.income.expected)}` : "vs mes anterior"} />
            <Stat label="Gastos" value={money(current.expense)} delta={!inProgress && previous ? <Delta inverse pct={previous.expense ? ((current.expense - previous.expense) / previous.expense) * 100 : null} /> : undefined} hint={inProgress ? `mes en curso · previstos ${money(forecast.fixedTotal + forecast.variablePredicted)}` : "vs mes anterior"} />
            <Stat label="Ahorrado e invertido" value={money(current.saved + Math.max(0, current.net))} hint={`${money(current.saved)} a inversión`} />
            <Stat label="Tasa de ahorro" value={inProgress ? "—" : formatPct(current.savingsRate)} hint={inProgress ? "se calcula al cerrar el mes" : "(ingresos − gastos) / ingresos"} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>Ingresos y gastos, 12 meses</SectionTitle>
          <GroupedBars
            ariaLabel="Ingresos y gastos de los últimos 12 meses"
            data={summary.map((s) => ({ month: s.month, income: s.income, expense: s.expense }))}
            xKey="month"
            xFormat={(m) => formatMonth(m, "short")}
            series={[{ key: "income", label: "Ingresos", color: series(1) }, { key: "expense", label: "Gastos", color: series(2) }]}
            format={(n) => money(n)}
            compactAxis={(n) => money(n, { compact: true })}
          />
        </Card>

        <Card>
          <SectionTitle>Reparto 50/30/20</SectionTitle>
          <p className="text-sm text-muted">Cuánto de tus ingresos de {formatMonth(month)}{inProgress ? " (previstos)" : ""} fue a necesidades, caprichos y ahorro.</p>
          {(["needs", "wants", "savings"] as const).map((g) => {
            const label = { needs: "Necesidades", wants: "Caprichos y ocio", savings: "Ahorro e inversión" }[g];
            const target = { needs: 50, wants: 30, savings: 20 }[g];
            const value = g === "savings" ? groups.savings + Math.max(0, current.net) : groups[g];
            const pct = incomeBase > 0 ? (value / incomeBase) * 100 : 0;
            const tone = g === "savings" ? (pct >= target ? "success" : "warning") : pct > target ? "warning" : "success";
            return (
              <div key={g} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{label}</span>
                  <span className="tabular-nums text-muted">
                    {formatPct(pct, { decimals: 0 })} <span className="text-xs">(ideal {g === "savings" ? "≥" : "≤"} {target} %)</span>
                  </span>
                </div>
                <Meter label={label} value={pct} max={100} tone={tone} />
              </div>
            );
          })}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>Por categoría</SectionTitle>
          {byCat.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Sin gastos en {formatMonth(month)}.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {byCat.map((r) => {
                const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
                const avg = averages.get(r.categoryId ?? "none") ?? 0;
                return (
                  <li key={r.categoryId ?? "none"}>
                    <button type="button" onClick={() => setTrendCat(r.categoryId)} className="flex w-full flex-col gap-1 rounded-xl px-1 py-1 text-left hover:bg-surface-secondary">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-bold">
                          {c?.emoji ?? "❔"} {c?.name ?? "Sin categoría"} <span className="font-medium text-muted">· {r.count}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          {avg > 0 && <Delta inverse pct={((r.total - avg) / avg) * 100} className="text-xs" />}
                          <span className="w-24 text-right font-extrabold tabular-nums">{money(r.total)}</span>
                        </span>
                      </span>
                      <span className="block h-2.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
                        <span className="block h-full rounded-full" style={{ width: `${(r.total / maxCat) * 100}%`, background: "var(--chart-hero)" }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">El porcentaje compara con tu media de los 3 meses anteriores. Pulsa una categoría para ver su evolución.</p>
        </Card>

        <Card>
          <SectionTitle>Dónde más gastas</SectionTitle>
          {merchants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Sin datos.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {merchants.map((m, i) => (
                <li key={m.name} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right font-bold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                  <span className="text-xs text-muted">×{m.count}</span>
                  <span className="w-24 text-right font-extrabold tabular-nums">{money(m.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>Gasto acumulado del mes</SectionTitle>
          <TimeChart
            ariaLabel="Gasto acumulado día a día frente al mes anterior"
            data={cumulative}
            xKey="day"
            xFormat={(d) => `Día ${d}`}
            series={[{ key: "current", label: formatMonth(month), color: series(2), area: true }, { key: "previous", label: formatMonth(addMonthKey(month, -1)), color: "var(--chart-muted)", dashed: true }]}
            format={(n) => money(n)}
            compactAxis={(n) => money(n, { compact: true })}
            height={220}
          />
        </Card>

        <Card>
          <SectionTitle>Evolución de una categoría</SectionTitle>
          <SelectInput label="Categoría" hideLabel value={trendCat} onChange={setTrendCat} placeholder="Elige una categoría" options={expenseCats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))} />
          {trendCat ? (
            <GroupedBars ariaLabel="Gasto mensual de la categoría" data={trend} xKey="month" xFormat={(m) => formatMonth(m, "short")} series={[{ key: "value", label: catMap.get(trendCat)?.name ?? "", color: "var(--chart-hero)" }]} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} height={190} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">Elige una categoría para ver sus últimos 12 meses.</p>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle action={<Button size="sm" variant="secondary" onPress={() => setEditBudgets(!editBudgets)}>{editBudgets ? "Listo" : "Editar presupuestos"}</Button>}>Presupuestos</SectionTitle>
          {editBudgets ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {expenseCats.filter((c) => c.group !== "savings").map((c) => (
                <li key={c.id} className="flex items-end justify-between gap-3 rounded-xl border border-border p-2.5">
                  <span className="pb-3 font-bold">
                    {c.emoji} {c.name}
                    {averages.get(c.id) ? <span className="block text-xs font-medium text-muted">media {money(averages.get(c.id)!)}/mes</span> : null}
                  </span>
                  <BudgetEditor id={c.id} value={c.monthlyBudget} />
                </li>
              ))}
            </ul>
          ) : budgets.length === 0 ? (
            <p className="py-4 text-sm text-muted">Aún no hay presupuestos. Pulsa «Editar presupuestos» y pon un límite a las categorías que quieras vigilar.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {budgets.map((b) => (
                <li key={b.category.id} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold">
                      {b.category.emoji} {b.category.name}
                    </span>
                    <span className="tabular-nums text-muted">
                      {money(b.spent)} / {money(b.budget)}
                    </span>
                  </div>
                  <Meter label={`Presupuesto de ${b.category.name}`} value={b.spent} max={b.budget} tone={b.status === "over" ? "danger" : b.status === "warning" ? "warning" : "success"} />
                  <span className={cn("text-xs", b.status === "over" ? "font-bold text-danger" : "text-muted")}>
                    {b.status === "over" ? `Te has pasado ${money(b.spent - b.budget)}` : `Quedan ${money(b.budget - b.spent)}`}
                    {month === monthOf(today) && ` · al ritmo actual: ${money(b.projected)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={18} className="text-accent" aria-hidden="true" /> Revisión con IA
            </span>
          </SectionTitle>
          {!review && !reviewing && (
            <>
              <p className="text-sm text-muted">La IA revisa tus últimos 6 meses, suscripciones y presupuestos y te propone recortes concretos.</p>
              <Button onPress={runReview} isDisabled={txs.length === 0}>
                <Lightbulb size={16} aria-hidden="true" /> Analizar mis gastos
              </Button>
            </>
          )}
          {reviewing && (
            <p className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Spinner size="sm" /> Analizando…
            </p>
          )}
          {review && (
            <div className="flex flex-col gap-3 text-sm">
              <p>{review.summary}</p>
              <ul className="list-disc space-y-1 pl-5">
                {review.insights.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <h3 className="font-extrabold">Ideas para ahorrar</h3>
              <ul className="flex flex-col gap-2">
                {review.tips.map((t) => (
                  <li key={t.title} className="rounded-xl bg-surface-secondary p-2.5">
                    <p className="font-bold">
                      {t.title}
                      {t.monthlySaving ? <span className="text-success"> · ~{money(t.monthlySaving)}/mes</span> : null}
                    </p>
                    {t.detail && <p className="text-muted">{t.detail}</p>}
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" className="self-start" onPress={runReview}>
                Volver a analizar
              </Button>
              <Disclaimer />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
