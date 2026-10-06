"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Donut, GroupedBars, TimeChart } from "@/components/charts";
import { AppModal, Button, Card, Chip, Meter, MoneyInput, PageHeader, SectionTitle, Segmented, SelectInput, Spinner, Stat, TextAreaInput, TextInput, toast } from "@/components/ui";
import { DEFAULT_BUCKETS, type Bucket, type Payroll } from "@/core/domain/plan";
import { averageByCategory, monthlySummary } from "@/core/logic/cashflow";
import { addMonthKey, monthOf } from "@/core/logic/dates";
import { planBuckets } from "@/core/logic/forecast";
import { averageMonthlyIncome, estimatePayroll } from "@/core/logic/payroll";
import { cn } from "@/lib/cn";
import { series } from "@/lib/colors";
import { formatDay, formatMonth, formatNumber, formatPct } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { aiExtractPayslip } from "@/store/actions/ai";
import { useCollection } from "@/store/create-collection-store";
import { useDoc } from "@/store/create-doc-store";
import { useAccounts, useCashProjection, useCategoryMap, useForecast, useFx, useMoney } from "@/store/selectors";
import { plan, transactions } from "@/store/stores";

const BUCKET_SLOT: Record<Bucket["kind"], number> = { needs: 1, wants: 2, invest: 3, savings: 7, goal: 5 };

function patchPayroll(patch: Partial<Payroll>) {
  plan.patch({ payroll: { ...plan.get().payroll, ...patch } });
}

function PayslipModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await aiExtractPayslip(text);
      const p = plan.get().payroll;
      const payments = r.payments === 12 || r.payments === 14 ? r.payments : p.payments;
      patchPayroll({
        grossAnnual: r.grossAnnual ?? (r.grossMonthly ? r.grossMonthly * (r.proratedExtras ? 12 : payments) : p.grossAnnual),
        payments,
        irpfRate: r.irpfRate ?? p.irpfRate,
        netMonthlyOverride: r.netMonthly ?? p.netMonthlyOverride,
      });
      toast.success("Nómina leída", { description: [r.company, r.period, r.netMonthly ? `neto ${r.netMonthly} €` : null, r.irpfRate ? `IRPF ${r.irpfRate} %` : null].filter(Boolean).join(" · ") });
      onDone();
      onClose();
    } catch {
      toast.danger("La IA no ha podido leer la nómina");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppModal isOpen onOpenChange={(o) => !o && onClose()} title="Leer mi nómina con IA" footer={<><Button variant="tertiary" onPress={onClose}>Cancelar</Button><Button isPending={busy} isDisabled={text.trim().length < 40} onPress={run}>Analizar</Button></>}>
      <p className="text-sm text-muted">Copia y pega el texto de tu nómina (desde el PDF). Extraemos bruto, neto, IRPF y Seguridad Social y ajustamos tu plan. Puedes tapar tu nombre y DNI: no hacen falta.</p>
      <TextAreaInput label="Texto de la nómina" value={text} onChange={setText} rows={10} placeholder="TOTAL DEVENGADO 2.428,57 … RETENCIÓN IRPF 15,23 % … LÍQUIDO A PERCIBIR 1.873,20" />
      {busy && <p className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Leyendo…</p>}
    </AppModal>
  );
}

function BucketsEditor({ buckets }: { buckets: Bucket[] }) {
  const total = buckets.reduce((n, b) => n + b.percent, 0);
  const update = (id: string, patch: Partial<Bucket>) => plan.patch({ buckets: buckets.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  return (
    <div className="flex flex-col gap-2">
      {buckets.map((b) => (
        <div key={b.id} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <TextInput label="Nombre" value={b.name} onChange={(name) => update(b.id, { name })} />
          <TextInput label="%" type="number" min={0} max={100} value={String(b.percent)} onChange={(v) => update(b.id, { percent: Math.max(0, Math.min(100, Number(v) || 0)) })} />
          <Button isIconOnly variant="ghost" aria-label={`Quitar ${b.name}`} onPress={() => plan.patch({ buckets: buckets.filter((x) => x.id !== b.id) })}>
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onPress={() => plan.patch({ buckets: [...buckets, { id: `b${Date.now()}`, name: "Nuevo bloque", kind: "goal", percent: 0 }] })}>
          <Plus size={14} aria-hidden="true" /> Bloque
        </Button>
        <Button size="sm" variant="ghost" onPress={() => plan.patch({ buckets: DEFAULT_BUCKETS })}>
          Restablecer 50/25/15/10
        </Button>
        <span className={cn("ml-auto text-sm font-bold", total === 100 ? "text-success" : "text-warning")}>Total {total} %</span>
      </div>
    </div>
  );
}

export function PayrollScreen() {
  const today = useToday();
  const money = useMoney();
  const fx = useFx();
  const p = useDoc(plan);
  const pr = p.payroll;
  const accounts = useAccounts();
  const forecast = useForecast();
  const cash = useCashProjection(12);
  const txs = useCollection(transactions);
  const catMap = useCategoryMap();
  const [payslip, setPayslip] = useState(false);
  const [editBuckets, setEditBuckets] = useState(false);
  // Remounts the salary form after an AI import so its inputs show the new values.
  const [formVersion, setFormVersion] = useState(0);

  const est = useMemo(() => estimatePayroll(pr), [pr]);
  const income = useMemo(() => averageMonthlyIncome(pr), [pr]);
  const averages = useMemo(() => averageByCategory(txs, monthOf(today), 3, fx), [txs, today, fx]);
  const actual = useMemo(() => {
    const out = { needs: 0, wants: 0, savings: 0 };
    for (const [id, v] of averages) {
      const g = catMap.get(id)?.group;
      if (g === "needs" || g === "wants" || g === "savings") out[g] += v;
      else out.wants += v;
    }
    return out;
  }, [averages, catMap]);
  const buckets = planBuckets(p.buckets, income, actual);
  const history = useMemo(() => monthlySummary(txs, [addMonthKey(monthOf(today), -3), addMonthKey(monthOf(today), -2), addMonthKey(monthOf(today), -1)], catMap, fx), [txs, today, catMap, fx]);
  const realIncome = history.filter((h) => h.income > 0);
  const avgRealIncome = realIncome.length ? realIncome.reduce((n, h) => n + h.income, 0) / realIncome.length : null;

  const fixedPaid = forecast.fixed.filter((f) => f.paid);
  const fixedPending = forecast.fixed.filter((f) => !f.paid);

  return (
    <>
      <PageHeader
        title="Nómina y previsión"
        description="Cuánto cobras de verdad, a dónde va cada euro y cuánto te quedará después de gastos este mes y los próximos 12."
        actions={
          <Button variant="secondary" onPress={() => setPayslip(true)}>
            <FileText size={16} aria-hidden="true" /> Leer nómina con IA
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card key={formVersion} className="gap-4">
          <SectionTitle>Tu salario</SectionTitle>
          <MoneyInput label="Salario bruto anual" value={pr.grossAnnual || null} onChange={(v) => patchPayroll({ grossAnnual: v ?? 0 })} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Número de pagas</span>
            <Segmented label="Número de pagas" value={String(pr.payments) as "12" | "14"} onChange={(v) => patchPayroll({ payments: v === "12" ? 12 : 14 })} options={[{ id: "12", label: "12 pagas" }, { id: "14", label: "14 pagas" }]} className="self-start" size="sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Día de cobro" type="number" min={1} max={31} value={String(pr.payday)} onChange={(v) => patchPayroll({ payday: Math.max(1, Math.min(31, Number(v) || 1)) })} />
            <TextInput label="Hijos a cargo" type="number" min={0} max={10} value={String(pr.children)} onChange={(v) => patchPayroll({ children: Math.max(0, Math.min(10, Number(v) || 0)) })} />
            <MoneyInput label="IRPF de tu nómina" value={pr.irpfRate} onChange={(v) => patchPayroll({ irpfRate: v })} suffix="%" placeholder={formatNumber(est.irpfRate)} hint={pr.irpfRate == null ? "Vacío = estimado. Escribe el de tu recibo." : "Del recibo"} />
            <MoneyInput label="Neto real al mes" value={pr.netMonthlyOverride} onChange={(v) => patchPayroll({ netMonthlyOverride: v })} placeholder={formatNumber(est.netMonthly)} hint="Opcional: el líquido de tu nómina." />
            <MoneyInput label="Subida anual esperada" value={pr.raisePct} onChange={(v) => patchPayroll({ raisePct: v ?? 0 })} suffix="%" />
            <SelectInput label="Cuenta donde cobras" value={pr.accountId} onChange={(v) => patchPayroll({ accountId: v })} emptyLabel="—" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-sm font-bold">Otros ingresos mensuales</span>
            {pr.extras.map((x) => (
              <div key={x.id} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                <TextInput label="Concepto" value={x.name} onChange={(name) => patchPayroll({ extras: pr.extras.map((e) => (e.id === x.id ? { ...e, name } : e)) })} />
                <MoneyInput label="€/mes" value={x.monthly} onChange={(v) => patchPayroll({ extras: pr.extras.map((e) => (e.id === x.id ? { ...e, monthly: v ?? 0 } : e)) })} />
                <Button isIconOnly variant="ghost" aria-label={`Quitar ${x.name}`} onPress={() => patchPayroll({ extras: pr.extras.filter((e) => e.id !== x.id) })}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" className="self-start" onPress={() => patchPayroll({ extras: [...pr.extras, { id: `x${Date.now()}`, name: "Ingreso extra", monthly: 0 }] })}>
              <Plus size={14} aria-hidden="true" /> Añadir ingreso
            </Button>
          </div>
        </Card>

        <Card className="gap-4">
          <SectionTitle>De bruto a neto</SectionTitle>
          {pr.grossAnnual > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Neto al mes" value={money(pr.netMonthlyOverride ?? est.netMonthly)} hint={pr.payments === 14 ? `junio y diciembre: ${money(est.netExtraMonth)}` : undefined} />
                <Stat label="Neto al año" value={money(pr.netMonthlyOverride != null ? pr.netMonthlyOverride * pr.payments : est.netAnnual)} hint={`${money(income)}/mes de media con extras`} />
              </div>
              <Donut
                ariaLabel="Reparto del salario bruto"
                items={[
                  { key: "net", label: "Neto para ti", value: est.netAnnual, color: series(3) },
                  { key: "irpf", label: `IRPF (${formatPct(est.irpfRate)})`, value: est.irpf, color: series(2) },
                  { key: "ss", label: `Seguridad Social (${formatPct(est.ssRate, { decimals: 2 })})`, value: est.socialSecurity, color: series(1) },
                ]}
                format={(n) => money(n)}
              />
              <p className="text-xs text-muted">
                {est.estimatedIrpf ? "IRPF estimado con la escala general 2026, la reducción por rendimientos del trabajo y el mínimo personal y familiar. La retención real depende de tu comunidad autónoma y situación: si tienes la nómina, indícalo arriba." : "Usando el IRPF de tu nómina."}
                {avgRealIncome != null && ` Ingresos reales registrados (media 3 meses): ${money(avgRealIncome)}.`}
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Escribe tu salario bruto anual (o pega tu nómina) para calcular el neto, el IRPF y la Seguridad Social.</p>
          )}
        </Card>

        <Card className="gap-4">
          <SectionTitle action={<Button size="sm" variant="secondary" onPress={() => setEditBuckets(!editBuckets)}>{editBuckets ? "Listo" : "Editar"}</Button>}>¿A dónde va cada euro?</SectionTitle>
          {editBuckets ? (
            <BucketsEditor buckets={p.buckets} />
          ) : (
            <>
              <Donut ariaLabel="Plan de reparto de la nómina" items={buckets.map((b) => ({ key: b.bucket.id, label: `${b.bucket.name} (${b.bucket.percent} %)`, value: b.amount, color: series(BUCKET_SLOT[b.bucket.kind]) }))} format={(n) => money(n)} />
              <ul className="flex flex-col gap-2">
                {buckets.filter((b) => b.actual != null).map((b) => (
                  <li key={b.bucket.id} className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="font-bold">{b.bucket.name}: real vs plan</span>
                      <span className="tabular-nums text-muted">{money(b.actual!)} / {money(b.amount)}</span>
                    </div>
                    <Meter label={`${b.bucket.name} real frente al plan`} value={b.actual!} max={Math.max(b.amount, 1)} tone={b.actual! > b.amount ? "warning" : "success"} />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">«Real» es tu gasto medio de los últimos 3 meses en categorías de necesidad o capricho (puedes cambiarlo en Ajustes → Categorías).</p>
            </>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>
            <span>Previsión de {formatMonth(forecast.month)}</span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ingresos" value={money(forecast.income.expected)} hint={`${money(forecast.income.received)} recibidos`} />
            <Stat label="Gastos fijos" value={money(forecast.fixedTotal)} hint={`${money(forecast.fixedPending)} pendientes`} />
            <Stat label="Gasto variable previsto" value={money(forecast.variablePredicted)} hint={`${money(forecast.variableSpent)} ya gastados`} />
            <Stat label="Te quedará" value={<span className={forecast.free < 0 ? "text-danger" : "text-success"}>{money(forecast.free)}</span>} hint={`tras ${money(forecast.goals)} a metas y ${money(forecast.purchases)} a compras`} />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">En qué se irá (previsión por categoría)</h3>
              <ul className="flex flex-col gap-1.5">
                {forecast.byCategory.slice(0, 10).map((c) => {
                  const cat = catMap.get(c.categoryId);
                  return (
                    <li key={c.categoryId} className="flex flex-col gap-0.5 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-semibold">{cat?.emoji ?? "❔"} {cat?.name ?? "Sin categoría"}</span>
                        <span className="tabular-nums"><span className="text-muted">{money(c.spent)} /</span> <span className="font-bold">{money(c.predicted)}</span></span>
                      </div>
                      <Meter label={`${cat?.name ?? "Sin categoría"}: gastado frente a previsto`} value={c.spent} max={Math.max(1, c.predicted)} tone={c.spent > c.predicted ? "warning" : "accent"} />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">Cargos fijos del mes</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {[...fixedPending, ...fixedPaid].map((f) => (
                  <li key={`${f.recurring.id}-${f.date}`} className={cn("flex items-center justify-between gap-2 rounded-lg px-2 py-1", f.paid && "opacity-55")}>
                    <span className="truncate">
                      {f.recurring.emoji} {f.recurring.name} <span className="text-muted">· {formatDay(f.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {f.paid ? <Chip size="sm" color="success">Pagado</Chip> : <Chip size="sm" color="warning">Pendiente</Chip>}
                      <span className="w-20 text-right font-bold tabular-nums">{money(f.amount)}</span>
                    </span>
                  </li>
                ))}
                {forecast.fixed.length === 0 && <li className="text-muted">Añade tus recibos y suscripciones para verlos aquí.</li>}
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Meses con paga extra</SectionTitle>
          <p className="text-sm text-muted">Con 14 pagas, el neto de junio y diciembre casi se duplica. Decide ya qué harás con él.</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between rounded-xl bg-surface-secondary p-2.5"><span>Paga extra neta</span><span className="font-extrabold">{pr.payments === 14 ? money(est.netExtraMonth - est.netMonthly) : "—"}</span></li>
            <li className="flex justify-between rounded-xl bg-surface-secondary p-2.5"><span>Si la inviertes entera al 7 % (10 años)</span><span className="font-extrabold">{pr.payments === 14 ? money((est.netExtraMonth - est.netMonthly) * 2 * ((Math.pow(1.07, 10) - 1) / 0.07)) : "—"}</span></li>
          </ul>
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle>Liquidez prevista, próximos 12 meses</SectionTitle>
          <p className="text-sm text-muted">Parte de tu efectivo actual más lo que queda de este mes; suma nómina (con pagas extra), resta cobros recurrentes exactos, tu gasto variable medio y las compras planeadas en su fecha.</p>
          <TimeChart ariaLabel="Saldo líquido previsto mes a mes" data={cash.map((c) => ({ month: c.month, balance: c.balance }))} xKey="month" xFormat={(m) => formatMonth(m, "short")} series={[{ key: "balance", label: "Liquidez prevista", color: "var(--chart-hero)", area: true }]} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} reference={{ y: 0, label: "0" }} height={240} />
          <GroupedBars ariaLabel="Ingresos y gastos previstos por mes" data={cash.map((c) => ({ month: c.month, income: c.income, out: c.fixed + c.variable + c.oneOff }))} xKey="month" xFormat={(m) => formatMonth(m, "short")} series={[{ key: "income", label: "Ingresos previstos", color: series(1) }, { key: "out", label: "Gastos previstos", color: series(2) }]} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} height={200} />
        </Card>
      </div>
      {payslip && <PayslipModal onClose={() => setPayslip(false)} onDone={() => setFormVersion((v) => v + 1)} />}
    </>
  );
}
