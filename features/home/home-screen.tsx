"use client";

import { AlertTriangle, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, FlaskConical, Info, Landmark, LineChart, Plus, Sparkles, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Sparkline, TimeChart, TrendCard } from "@/components/charts";
import { Button, Card, Delta, Meter, MoneyText, PageHeader, ProgressRing, SectionTitle, Stat, toast } from "@/components/ui";
import { buildAlerts, type AlertTone } from "@/core/logic/alerts";
import { averageByCategory, budgetStatus, cumulativeDaily } from "@/core/logic/cashflow";
import { addDays, addMonthKey, monthOf } from "@/core/logic/dates";
import { fireNumbers } from "@/core/logic/fire";
import { toBase } from "@/core/logic/money";
import { rebalance } from "@/core/logic/portfolio";
import { cn } from "@/lib/cn";
import { ASSET_TYPE_SLOT, series } from "@/lib/colors";
import { cap, formatDay, formatMonth, formatNumber, formatPct } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useDoc } from "@/store/create-doc-store";
import { loadDemoData } from "@/store/demo";
import { useAgenda, useAnnualExpenses, useCashProjection, useCategoryMap, useForecast, useFx, useGoalSaved, useMoney, useNetWorth, usePositions } from "@/store/selectors";
import { accounts, categories, goals, plan, purchases, recurring, settings, snapshots, transactions } from "@/store/stores";
import { openTransaction } from "@/store/ui";
import { LiveValue } from "../investments/live";
import { AgendaList } from "../shared/agenda-list";

const TONE_ICON: Record<AlertTone, typeof Info> = { danger: XCircle, warning: AlertTriangle, info: Info, success: CheckCircle2 };
const TONE_CLASS: Record<AlertTone, string> = { danger: "text-danger", warning: "text-warning", info: "text-accent", success: "text-success" };

function Onboarding() {
  const steps = [
    { href: "/networth", title: "Añade tus cuentas y su saldo", text: "Banco, cuenta remunerada, efectivo… y lo que tengas (coche, hipoteca)." },
    { href: "/payroll", title: "Configura tu nómina", text: "Bruto anual y pagas: calculamos IRPF, Seguridad Social y tu neto." },
    { href: "/import", title: "Importa tus movimientos", text: "Sube el CSV o PDF del banco, o pega el texto: la IA los clasifica." },
    { href: "/investments", title: "Apunta tus inversiones", text: "Fondos indexados, ETFs, acciones o cripto con su peso en la cartera." },
  ];
  return (
    <Card className="mb-6 gap-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight">Bienvenido a FireNances 🔥</h2>
        <p className="mt-1 max-w-2xl text-muted">Tus finanzas personales, en tu dispositivo y sin conectar el banco. Cuatro pasos y tendrás tu patrimonio, previsiones y plan FIRE.</p>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="choice h-full flex-col items-start gap-1">
              <span className="grid size-7 place-items-center rounded-full bg-accent text-sm font-black text-accent-foreground">{i + 1}</span>
              <span className="font-extrabold">{s.title}</span>
              <span className="text-sm font-medium text-muted">{s.text}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="secondary" onPress={() => { loadDemoData(); toast.success("Datos de ejemplo cargados", { description: "Bórralos cuando quieras en Ajustes → Datos." }); }}>
          <FlaskConical size={16} aria-hidden="true" /> Probar con datos de ejemplo
        </Button>
        <span className="text-sm text-muted">Todo se guarda solo en este navegador. Puedes exportar una copia en Ajustes.</span>
      </div>
    </Card>
  );
}

export function HomeScreen() {
  const today = useToday();
  const money = useMoney();
  const s = useDoc(settings);
  const p = useDoc(plan);
  const nw = useNetWorth();
  const fx = useFx();
  const forecast = useForecast();
  const cash = useCashProjection(12);
  const { rows, totals } = usePositions();
  const snaps = useCollection(snapshots);
  const txs = useCollection(transactions);
  const accs = useCollection(accounts);
  const cats = useCollection(categories);
  const rec = useCollection(recurring);
  const gs = useCollection(goals);
  const ps = useCollection(purchases);
  const catMap = useCategoryMap();
  const goalSaved = useGoalSaved();
  const expenses = useAnnualExpenses();
  const agenda = useAgenda(today, addDays(today, 21));
  const empty = accs.length === 0 && txs.length === 0 && rows.length === 0;

  const history = useMemo(() => [...snaps].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ date: x.date, total: x.total })), [snaps]);
  const monthAgo = useMemo(() => {
    const cutoff = addDays(today, -30);
    return [...history].reverse().find((h) => h.date <= cutoff) ?? history[0];
  }, [history, today]);
  const change = monthAgo ? nw.total - monthAgo.total : null;

  const budgets = useMemo(() => budgetStatus(cats, txs, monthOf(today), today, fx), [cats, txs, today, fx]);
  const averages = useMemo(() => averageByCategory(txs, monthOf(today), 3, fx), [txs, today, fx]);
  const alerts = useMemo(
    () =>
      buildAlerts({
        today,
        budgets,
        forecast,
        cash,
        recurring: rec,
        goals: gs,
        goalSaved,
        purchases: ps,
        rebalance: rebalance(rows, totals.monthlyContribution),
        liquidCash: nw.cash,
        monthlyExpenses: expenses.annual / 12,
        categoryName: (id) => catMap.get(id)?.name ?? "Sin categoría",
        categoryAverages: averages,
        money: (n) => money(n),
        date: (d) => formatDay(d),
      }),
    [today, budgets, forecast, cash, rec, gs, goalSaved, ps, rows, totals.monthlyContribution, nw.cash, expenses.annual, catMap, averages, money],
  );

  const fire = fireNumbers(expenses.annual, p.fire);
  const fireProgress = fire.fire > 0 ? nw.fireAssets / fire.fire : 0;
  const spentRatio = forecast.income.expected > 0 ? (forecast.variableSpent + forecast.fixedTotal - forecast.fixedPending) / forecast.income.expected : 0;
  // Spend so far this month vs the same day last month, and its daily curve (for the trend card).
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
  const curveNow = cumulativeDaily(txs, month, fx);
  const curvePrev = cumulativeDaily(txs, addMonthKey(month, -1), fx);
  const spentNow = curveNow[day - 1] ?? 0;
  const spentPrev = curvePrev[Math.min(day, curvePrev.length) - 1] ?? 0;
  // Rolling 30-day cumulative spend: a smooth curve that always has data, unlike the month so far.
  const spendCurve = (() => {
    const from = addDays(today, -29);
    const perDay = new Map<string, number>();
    for (const t of txs) {
      if (t.kind !== "expense" || t.excluded || t.deletedAt || t.date < from || t.date > today) continue;
      perDay.set(t.date, (perDay.get(t.date) ?? 0) + toBase(t.amount, t.currency, fx));
    }
    return Array.from({ length: 30 }, (_, i) => perDay.get(addDays(from, i)) ?? 0).reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + v], []);
  })();
  const investHistory = [...snaps].sort((a, b) => a.date.localeCompare(b.date)).slice(-30).map((x) => x.investments);

  return (
    <>
      <PageHeader
        title={s.displayName ? `Hola, ${s.displayName}` : "Inicio"}
        description={`${cap(formatDay(today, "full"))} · tu dinero de un vistazo`}
        actions={
          <>
            <Button variant="secondary" onPress={() => openTransaction({ kind: "income" })}>
              <Plus size={16} aria-hidden="true" /> Ingreso
            </Button>
            <Button onPress={() => openTransaction()}>
              <Plus size={16} aria-hidden="true" /> Gasto
            </Button>
          </>
        }
      />

      {empty && <Onboarding />}

      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-3xl font-normal tracking-tight">Resumen</h2>
        <span className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted">30 días</span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <TrendCard
          href="/networth"
          title="Patrimonio neto"
          description="Lo que tienes menos lo que debes"
          value={<MoneyText value={money(nw.total)} />}
          delta={change != null && monthAgo && monthAgo.total ? formatPct((change / Math.abs(monthAgo.total)) * 100, { sign: true }) : undefined}
          deltaLabel={monthAgo ? `desde el ${formatDay(monthAgo.date)}` : "aún sin histórico"}
          values={history.slice(-30).map((h) => h.total)}
          color="var(--accent)"
        />
        <TrendCard
          href="/analysis"
          title="Gasto del mes"
          description={`Gastado en ${formatMonth(monthOf(today))}`}
          value={<MoneyText value={money(spentNow)} />}
          delta={spentPrev > 0 ? formatPct(((spentNow - spentPrev) / spentPrev) * 100, { sign: true }) : undefined}
          deltaLabel="vs. el mes pasado a estas alturas"
          values={spendCurve}
          color={series(3)}
        />
        <TrendCard
          href="/investments"
          title="Inversiones"
          description="Valor de mercado de tu cartera"
          value={<MoneyText value={money(totals.value)} />}
          delta={totals.dayChangePct != null ? formatPct(totals.dayChangePct, { sign: true }) : undefined}
          deltaLabel="hoy"
          values={investHistory}
          color={series(7)}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="card hero-tint gap-3 xl:col-span-2" aria-label="Evolución del patrimonio">
          <SectionTitle
            description={<>Tu patrimonio neto día a día · <CalendarDays size={14} className="inline -mt-0.5" aria-hidden="true" /> {history.length ? `${history.length} días registrados` : "sin datos"}</>}
            action={
              <Link href="/networth" className="btn btn-secondary btn-sm btn-icon" aria-label="Ver patrimonio">
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            }
          >
            Evolución del patrimonio
          </SectionTitle>
          {history.length > 1 ? (
            <TimeChart ariaLabel="Evolución del patrimonio neto" data={history} xKey="date" xFormat={(d) => formatDay(d)} series={[{ key: "total", label: "Patrimonio", color: "var(--chart-hero)", area: true }]} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} height={250} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Tu evolución aparecerá aquí: guardamos una foto diaria de tu patrimonio.</p>
          )}
          {history.length > 1 && (
            <div className="flex items-end justify-between gap-3 border-t border-border pt-3 text-sm">
              <div>
                <p className="text-muted">Variación</p>
                <p className="text-lg">{formatPct(((history[history.length - 1].total - history[0].total) / Math.max(1, Math.abs(history[0].total))) * 100, { sign: true })}</p>
              </div>
              <div className="text-right">
                <p className="text-muted">Periodo</p>
                <p className="tabular-nums">{formatDay(history[0].date, "long")} – {formatDay(history[history.length - 1].date, "long")}</p>
              </div>
            </div>
          )}
        </section>

        <Card className="gap-3">
          <SectionTitle description="Tus posiciones y su último año" action={<Link href="/investments" className="btn btn-secondary btn-sm btn-icon" aria-label="Ver inversiones"><ArrowUpRight size={16} aria-hidden="true" /></Link>}>
            Cartera
          </SectionTitle>
          {rows.length === 0 ? (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="text-sm text-muted">Apunta tus fondos, ETFs, acciones o cripto para ver su valor, noticias y análisis.</p>
              <Link href="/investments" className="btn btn-secondary btn-sm">
                <LineChart size={15} aria-hidden="true" /> Añadir inversión
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {rows.slice(0, 6).map((r) => {
                const hist = r.quote?.history ?? [];
                return (
                  <li key={r.holding.id}>
                    <Link href={`/investments/${r.holding.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-surface-secondary">
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white" style={{ background: series(ASSET_TYPE_SLOT[r.holding.assetType] ?? 8) }}>
                        {(r.holding.symbol || r.holding.name)[0]?.toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{r.holding.name}</span>
                      {hist.length > 1 ? <Sparkline values={hist.slice(-120).map((h) => h[1])} color="var(--chart-hero)" className="h-7 w-16" /> : <span className="w-16" />}
                      <LiveValue quote={r.quote}>
                        <Delta pct={r.quote ? r.quote.changePct : null} className="w-16 justify-end text-xs" />
                      </LiveValue>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="mt-auto flex items-end justify-between border-t border-border pt-3 text-sm">
              <div>
                <p className="text-muted">Hoy</p>
                <p className="text-lg">{formatPct(totals.dayChangePct, { sign: true })}</p>
              </div>
              <div className="text-right">
                <p className="text-muted">Rentabilidad total</p>
                <p className="text-lg">{formatPct(totals.pnlPct, { sign: true })}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="gap-3">
          <SectionTitle action={<Link href="/payroll" className="text-sm font-bold text-accent">Previsión</Link>}>{cap(formatMonth(monthOf(today)))}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Ingresos previstos" value={money(forecast.income.expected)} hint={`${money(forecast.income.received)} recibidos`} />
            <Stat label="Libre a fin de mes" value={<span className={forecast.free < 0 ? "text-danger" : "text-success"}>{money(forecast.free)}</span>} hint="tras gastos, metas y compras" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm font-semibold">
              <span>Gastado {money(forecast.variableSpent + forecast.fixedTotal - forecast.fixedPending)}</span>
              <span className="text-muted">previsto {money(forecast.variablePredicted + forecast.fixedTotal)}</span>
            </div>
            <Meter label="Gasto sobre ingresos" value={spentRatio * 100} max={100} tone={spentRatio > 0.9 ? "danger" : spentRatio > 0.7 ? "warning" : "accent"} />
            <p className="text-xs text-muted">
              Quedan {money(forecast.fixedPending)} en cargos fijos este mes. {forecast.income.expected === 0 && <Link className="font-bold text-accent" href="/payroll">Configura tu nómina</Link>}
            </p>
          </div>
        </Card>

        <Card>
          <SectionTitle>Avisos</SectionTitle>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-sm font-semibold text-muted">
              <CheckCircle2 size={18} className="text-success" aria-hidden="true" /> Todo en orden. Sin sorpresas a la vista.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {alerts.slice(0, 6).map((a) => {
                const Icon = TONE_ICON[a.tone];
                return (
                  <li key={a.id}>
                    <Link href={a.href} className="flex gap-3 rounded-xl px-2 py-2 hover:bg-surface-secondary">
                      <Icon size={19} aria-hidden="true" className={cn("mt-0.5 shrink-0", TONE_CLASS[a.tone])} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{a.title}</span>
                        <span className="block text-xs text-muted">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle action={<Link href="/calendar" className="text-sm font-bold text-accent">Calendario</Link>}>Próximos 21 días</SectionTitle>
          <AgendaList items={agenda.slice(0, 8)} empty="Nada programado. Añade suscripciones o tu nómina para verlos aquí." compact />
        </Card>

        <Card>
          <SectionTitle action={<Link href="/analysis" className="text-sm font-bold text-accent">Gastos</Link>}>Presupuestos del mes</SectionTitle>
          {budgets.length === 0 ? (
            <p className="py-2 text-sm text-muted">Pon un presupuesto mensual a tus categorías en Gastos → Presupuestos.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {budgets.slice(0, 5).map((b) => (
                <li key={b.category.id} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-bold">
                      {b.category.emoji} {b.category.name}
                    </span>
                    <span className="tabular-nums text-muted">
                      {money(b.spent)} / {money(b.budget)}
                    </span>
                  </div>
                  <Meter label={`Presupuesto ${b.category.name}`} value={b.spent} max={b.budget} tone={b.status === "over" ? "danger" : b.status === "warning" ? "warning" : "success"} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex-row items-center gap-4">
          <ProgressRing ratio={fireProgress} size={104} stroke={10}>
            <span className="text-lg font-black">{formatPct(Math.min(100, fireProgress * 100), { decimals: 0 })}</span>
          </ProgressRing>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold">Camino a FIRE</h2>
            {fire.fire > 0 ? (
              <p className="text-sm text-muted">
                Tienes {money(nw.fireAssets)} de {money(fire.fire)} (gasto anual {money(expenses.annual)} al {p.fire.withdrawalRate} %).
              </p>
            ) : (
              <p className="text-sm text-muted">Necesitamos tu gasto anual: registra movimientos o indícalo en FIRE.</p>
            )}
            <Link href="/fire" className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-accent">
              Ver plan <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card className="flex-row items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent" aria-hidden="true">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">¿Tienes el extracto del banco?</h2>
            <p className="text-sm text-muted">Sube el PDF o CSV y la IA registrará y clasificará tus movimientos.</p>
          </div>
          <Link href="/import" className="btn btn-secondary btn-sm">
            Importar
          </Link>
        </Card>

        <Card className="flex-row items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent" aria-hidden="true">
            {accs.length ? <Wallet size={22} /> : <Landmark size={22} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">Liquidez para {expenses.annual > 0 ? `${formatNumber(nw.cash / (expenses.annual / 12), 1)} meses` : "—"}</h2>
            <p className="text-sm text-muted">Fondo de emergencia recomendado: 3–6 meses de gastos.</p>
          </div>
          <Link href="/savings" className="btn btn-secondary btn-sm">
            Metas
          </Link>
        </Card>
      </div>
    </>
  );
}
