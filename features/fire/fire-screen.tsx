"use client";

import { Flame, Info } from "lucide-react";
import { useMemo } from "react";
import { FanChart, TimeChart } from "@/components/charts";
import { Card, Chip, Meter, MoneyInput, PageHeader, RangeField, SectionTitle, Stat, TextInput } from "@/components/ui";
import type { FireSettings } from "@/core/domain/plan";
import { firePlan, yearsSaved } from "@/core/logic/fire";
import { retirementSuccess, simulate } from "@/core/logic/projection";
import { cn } from "@/lib/cn";
import { series } from "@/lib/colors";
import { formatNumber, formatPct, formatYears } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useDoc } from "@/store/create-doc-store";
import { useAnnualExpenses, useMoney, useMonthlyIncome, useNetWorth } from "@/store/selectors";
import { plan } from "@/store/stores";

const patchFire = (patch: Partial<FireSettings>) => plan.patch({ fire: { ...plan.get().fire, ...patch } });

export function FireScreen() {
  const today = useToday();
  const money = useMoney();
  const p = useDoc(plan);
  const f = p.fire;
  const nw = useNetWorth();
  const expenses = useAnnualExpenses();
  const income = useMonthlyIncome();
  const thisYear = Number(today.slice(0, 4));
  const investShare = p.buckets.filter((b) => b.kind === "invest" || b.kind === "savings").reduce((n, b) => n + b.percent, 0);
  const autoMonthly = (income * investShare) / 100;
  const monthly = f.monthlyContribution ?? autoMonthly;
  const annual = expenses.annual;

  const result = useMemo(() => firePlan({ s: f, annualExpenses: annual, current: nw.fireAssets, monthly, thisYear }), [f, annual, nw.fireAssets, monthly, thisYear]);
  const yearsToTargetAge = result.currentAge != null ? Math.max(1, f.targetAge - result.currentAge) : 25;
  const mc = useMemo(() => (annual > 0 ? simulate({ initial: nw.fireAssets, monthly, years: Math.min(50, yearsToTargetAge + 10), annualReturn: f.expectedReturn, volatility: f.volatility, inflation: f.inflation, target: result.numbers.fire, paths: 800 }) : null), [annual, nw.fireAssets, monthly, yearsToTargetAge, f.expectedReturn, f.volatility, f.inflation, result.numbers.fire]);
  const survival = useMemo(() => (annual > 0 ? retirementSuccess({ portfolio: result.numbers.fire, annualWithdrawal: annual, years: 45, annualReturn: f.expectedReturn, volatility: f.volatility, inflation: f.inflation, paths: 800 }) : null), [annual, result.numbers.fire, f.expectedReturn, f.volatility, f.inflation]);
  const successAtAge = mc ? mc.successByYear[Math.min(mc.successByYear.length - 1, yearsToTargetAge)] : null;
  const savingsRate = income > 0 ? (monthly / income) * 100 : null;

  const timeline = result.timeline.map((t) => ({ label: t.age != null ? `${t.age} años` : String(t.year), value: t.value, fire: result.numbers.fire, lean: result.numbers.lean, fat: result.numbers.fat }));
  const fan = mc ? mc.bands.map((b) => ({ x: result.currentAge != null ? `${result.currentAge + b.year}` : `+${b.year}`, low: b.p10, band: b.p90 - b.p10, mid: b.p50 })) : [];

  const targets: { key: keyof typeof result.numbers; label: string; text: string }[] = [
    { key: "lean", label: "Lean FIRE", text: `Vida austera (${Math.round(f.leanFactor * 100)} % de tu gasto)` },
    { key: "fire", label: "FIRE", text: "Tu nivel de vida actual" },
    { key: "fat", label: "Fat FIRE", text: `Vida holgada (${Math.round(f.fatFactor * 100)} % de tu gasto)` },
    { key: "barista", label: "Barista FIRE", text: `Con un trabajo parcial de ${money(f.baristaIncome)}/año` },
  ];

  return (
    <>
      <PageHeader title="FIRE: independencia financiera" description="Cuánto necesitas para vivir de tus inversiones, cuándo llegarías con distintas estrategias y con qué probabilidad." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="gap-4">
          <SectionTitle>Tus supuestos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Año de nacimiento" type="number" min={1940} max={2015} value={f.birthYear ? String(f.birthYear) : ""} onChange={(v) => patchFire({ birthYear: v ? Math.max(1920, Math.min(2020, Number(v))) : null })} />
            <TextInput label="Edad objetivo" type="number" min={25} max={80} value={String(f.targetAge)} onChange={(v) => patchFire({ targetAge: Math.max(25, Math.min(80, Number(v) || 50)) })} />
          </div>
          <MoneyInput label="Gasto anual en la independencia" value={f.annualExpenses} onChange={(v) => patchFire({ annualExpenses: v })} placeholder={expenses.source === "history" ? formatNumber(expenses.annual, 0) : "0"} hint={expenses.source === "history" ? `Vacío = tu gasto real de los últimos ${expenses.months} meses: ${money(expenses.annual)}/año` : expenses.source === "none" ? "Sin movimientos aún: indícalo a mano." : "Valor manual. Vacíalo para usar tu historial."} />
          <MoneyInput label="Aportación mensual a la inversión" value={f.monthlyContribution} onChange={(v) => patchFire({ monthlyContribution: v })} placeholder={formatNumber(autoMonthly, 0)} hint={`Vacío = ${investShare} % de tu ingreso medio según tu plan de nómina: ${money(autoMonthly)}/mes`} />
          <RangeField label="Tasa de retiro segura" value={f.withdrawalRate} onChange={(v) => patchFire({ withdrawalRate: v })} min={2.5} max={5} step={0.25} valueLabel={`${f.withdrawalRate} %`} />
          <RangeField label="Rentabilidad nominal esperada" value={f.expectedReturn} onChange={(v) => patchFire({ expectedReturn: v })} min={1} max={10} step={0.5} valueLabel={`${f.expectedReturn} %`} />
          <RangeField label="Inflación" value={f.inflation} onChange={(v) => patchFire({ inflation: v })} min={0} max={6} step={0.25} valueLabel={`${f.inflation} %`} />
          <RangeField label="Volatilidad de la cartera" value={f.volatility} onChange={(v) => patchFire({ volatility: v })} min={2} max={25} step={1} valueLabel={`${f.volatility} %`} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Ingreso Barista anual" value={f.baristaIncome} onChange={(v) => patchFire({ baristaIncome: v ?? 0 })} />
            <MoneyInput label="Pensión pública esperada/año" value={f.pension} onChange={(v) => patchFire({ pension: v ?? 0 })} hint={`desde los ${f.pensionAge}`} />
          </div>
        </Card>

        <div className="flex flex-col gap-5 xl:col-span-2">
          <Card className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Stat size="lg" label="Tu número FIRE" value={annual > 0 ? money(result.numbers.fire) : "—"} hint={annual > 0 ? `${money(annual)}/año × ${(100 / f.withdrawalRate).toFixed(0)} (regla del ${f.withdrawalRate} %)` : "Necesitamos tu gasto anual"} />
              <Stat label="Patrimonio que cuenta" value={money(nw.fireAssets)} hint="inversiones + liquidez + bienes marcados" />
              <Stat label="Tasa de ahorro" value={formatPct(savingsRate)} hint={`${money(monthly)}/mes invertidos`} />
            </div>
            {annual > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm font-bold"><span>Progreso</span><span>{formatPct(result.progress)}</span></div>
                <Meter label="Progreso hacia FIRE" value={result.progress} max={100} tone="success" />
                <p className="text-sm text-muted">Hoy tus inversiones podrían pagarte ~{money(result.safeMonthlyIncome)}/mes de forma sostenible. Rentabilidad real usada: {formatPct(result.realReturn)}.</p>
              </div>
            )}
          </Card>

          {annual > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {targets.map((t) => {
                const years = result.yearsTo[t.key];
                const age = result.ageAt[t.key];
                return (
                  <li key={t.key} className="card gap-1.5">
                    <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted"><Flame size={15} aria-hidden="true" /> {t.label}</span>
                    <span className="text-xl font-black tabular-nums">{money(result.numbers[t.key])}</span>
                    <span className="text-sm text-muted">{t.text}</span>
                    <span className={cn("text-sm font-bold", years === 0 ? "text-success" : "")}>{years === 0 ? "¡Ya lo tienes!" : `En ${formatYears(years)}${age != null ? ` · a los ${Math.round(age)}` : ""}`}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {annual > 0 && f.pension > 0 && (
            <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              Con una pensión de {money(f.pension)}/año desde los {f.pensionAge}, a partir de esa edad bastaría con <strong className="text-foreground">{money((Math.max(0, annual - f.pension) * 100) / f.withdrawalRate)}</strong>. Hasta entonces, tu cartera debe cubrir todo el gasto.
            </p>
          )}

          {annual > 0 && (
            <Card>
              <SectionTitle>
                <span className="flex flex-wrap items-center gap-2">Coast FIRE {result.coast.reached ? <Chip size="sm" color="success">Alcanzado</Chip> : <Chip size="sm">Pendiente</Chip>}</span>
              </SectionTitle>
              <p className="text-sm text-muted">
                Si tuvieras <strong className="text-foreground">{money(result.coast.needed)}</strong> invertidos hoy, sin aportar nada más llegarías a tu número FIRE a los {f.targetAge} ({result.coast.yearsToTarget} años de crecimiento real). {result.coast.reached ? "Ya podrías dejar de aportar y solo cubrir tus gastos." : `Te faltan ${money(Math.max(0, result.coast.needed - nw.fireAssets))}.`}
              </p>
            </Card>
          )}
        </div>

        {annual > 0 && (
          <Card className="xl:col-span-3">
            <SectionTitle>Trayectoria prevista (en dinero de hoy)</SectionTitle>
            <TimeChart
              ariaLabel="Proyección del patrimonio frente a los objetivos FIRE"
              data={timeline}
              xKey="label"
              series={[{ key: "value", label: "Tu cartera", color: series(1), area: true }, { key: "lean", label: "Lean FIRE", color: series(3), dashed: true }, { key: "fire", label: "FIRE", color: series(2), dashed: true }, { key: "fat", label: "Fat FIRE", color: series(7), dashed: true }]}
              format={(n) => money(n)}
              compactAxis={(n) => money(n, { compact: true })}
              height={300}
            />
          </Card>
        )}

        {mc && (
          <Card className="xl:col-span-2">
            <SectionTitle>Simulación Monte Carlo (800 escenarios)</SectionTitle>
            <p className="text-sm text-muted">Los mercados no suben en línea recta. Simulamos años buenos y malos con una volatilidad del {f.volatility} %.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={`Prob. de FIRE a los ${f.targetAge}`} value={successAtAge != null ? formatPct(successAtAge, { decimals: 0 }) : "—"} />
              <Stat label="Mediana a esa edad" value={money(mc.bands[Math.min(mc.bands.length - 1, yearsToTargetAge)].p50)} />
              <Stat label="Escenario malo (p10)" value={money(mc.bands[Math.min(mc.bands.length - 1, yearsToTargetAge)].p10)} />
            </div>
            <FanChart ariaLabel="Rango de resultados de la simulación" data={fan} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} target={result.numbers.fire} targetLabel="Número FIRE" />
          </Card>
        )}

        <div className="flex flex-col gap-5">
          {survival != null && (
            <Card>
              <SectionTitle>¿Aguantará el dinero?</SectionTitle>
              <Stat label="Supervivencia a 45 años" value={formatPct(survival, { decimals: 0 })} hint={`retirando ${money(annual)}/año ajustado a inflación`} />
              <p className="text-sm text-muted">{survival >= 90 ? "Muy robusto." : survival >= 75 ? "Razonable; un 3,5 % de retiro daría más margen." : "Arriesgado para un retiro largo: baja la tasa de retiro o sube el colchón."}</p>
            </Card>
          )}
          {annual > 0 && (
            <Card>
              <SectionTitle>Palancas</SectionTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {[100, 250, 500].map((extra) => {
                  const saved = yearsSaved({ current: nw.fireAssets, monthly, extra, realReturnPct: result.realReturn, target: result.numbers.fire });
                  return (
                    <li key={extra} className="flex justify-between gap-2 rounded-xl bg-surface-secondary p-2.5">
                      <span>Invertir {money(extra)} más al mes</span>
                      <span className="font-extrabold text-success">{saved != null ? `−${formatYears(saved)}` : "—"}</span>
                    </li>
                  );
                })}
                {(() => {
                  const lower = firePlan({ s: f, annualExpenses: annual * 0.9, current: nw.fireAssets, monthly: monthly + (annual * 0.1) / 12, thisYear });
                  const diff = result.yearsTo.fire != null && lower.yearsTo.fire != null ? result.yearsTo.fire - lower.yearsTo.fire : null;
                  return (
                    <li className="flex justify-between gap-2 rounded-xl bg-surface-secondary p-2.5">
                      <span>Gastar un 10 % menos (e invertirlo)</span>
                      <span className="font-extrabold text-success">{diff != null ? `−${formatYears(diff)}` : "—"}</span>
                    </li>
                  );
                })()}
              </ul>
            </Card>
          )}
          <Card>
            <p className="flex gap-2 text-sm text-muted">
              <Info size={18} className="shrink-0 text-accent" aria-hidden="true" />
              Modelo educativo. La regla del 4 % viene de estudios con datos de EE. UU.; para retiros de más de 40 años muchos usan 3–3,5 %. En España, recuerda que vender inversiones tributa (19–28 %) y que los traspasos entre fondos no.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
