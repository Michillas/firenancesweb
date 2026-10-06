"use client";

import { PiggyBank, Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeChart } from "@/components/charts";
import { AppModal, Button, Card, Chip, EmojiBadge, EmptyState, Meter, MoneyInput, PageHeader, RangeField, SectionTitle, SelectInput, Stat, SwitchField, TextAreaInput, TextInput, confirmAction, promptMoney } from "@/components/ui";
import { GOAL_KINDS, type Goal } from "@/core/domain/finance";
import { diffMonths, monthOf } from "@/core/logic/dates";
import { monthsToTarget, project, requiredMonthly, STRATEGIES } from "@/core/logic/projection";
import { cn } from "@/lib/cn";
import { series } from "@/lib/colors";
import { formatDay, formatNumber, formatYears } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useAccounts, useAnnualExpenses, useForecast, useGoalSaved, useMoney, useNetWorth } from "@/store/selectors";
import { goals } from "@/store/stores";

const KIND_LABEL: Record<(typeof GOAL_KINDS)[number], string> = { emergency: "Fondo de emergencia", house: "Vivienda", car: "Coche", travel: "Viaje", education: "Formación", retirement: "Jubilación", wedding: "Boda / evento", other: "Otra meta" };
const KIND_EMOJI: Record<(typeof GOAL_KINDS)[number], string> = { emergency: "🛟", house: "🏡", car: "🚗", travel: "✈️", education: "🎓", retirement: "🏖️", wedding: "💍", other: "🎯" };

function GoalModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const accounts = useAccounts();
  const expenses = useAnnualExpenses();
  const [kind, setKind] = useState<Goal["kind"]>(goal?.kind ?? "other");
  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [target, setTarget] = useState<number | null>(goal?.target ?? null);
  const [saved, setSaved] = useState<number | null>(goal?.saved ?? null);
  const [accountId, setAccountId] = useState<string | null>(goal?.accountId ?? null);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [monthly, setMonthly] = useState<number | null>(goal?.monthlyContribution ?? null);
  const [ret, setRet] = useState<number | null>(goal?.expectedReturn ?? 0);
  const [priority, setPriority] = useState(String(goal?.priority ?? 2));
  const [done, setDone] = useState(goal?.done ?? false);
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const save = () => {
    const row = { kind, name: name.trim(), emoji, target: target ?? 0, saved: saved ?? 0, accountId, deadline: deadline || null, monthlyContribution: monthly ?? 0, expectedReturn: ret ?? 0, priority: Number(priority), done, notes };
    if (goal) goals.update(goal.id, row);
    else goals.create(row);
    onClose();
  };
  const suggestEmergency = expenses.annual > 0 ? Math.round((expenses.annual / 12) * 6) : null;
  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={goal ? "Editar meta" : "Nueva meta de ahorro"}
      footer={
        <>
          {goal && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={async () => { if (await confirmAction({ title: `¿Eliminar «${goal.name}»?`, danger: true, confirmLabel: "Eliminar" })) { goals.remove(goal.id); onClose(); } }}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim() || !target} onPress={save}>Guardar</Button>
        </>
      }
    >
      <SelectInput label="Tipo de meta" value={kind} onChange={(v) => { const k = (v as Goal["kind"]) ?? "other"; setKind(k); setEmoji(KIND_EMOJI[k]); if (!name) setName(KIND_LABEL[k]); if (k === "emergency" && !target && suggestEmergency) setTarget(suggestEmergency); }} options={GOAL_KINDS.map((k) => ({ id: k, label: `${KIND_EMOJI[k]} ${KIND_LABEL[k]}` }))} />
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextInput label="Emoji" value={emoji} onChange={setEmoji} />
        <TextInput label="Nombre" value={name} onChange={setName} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Objetivo" value={target} onChange={setTarget} hint={kind === "emergency" && suggestEmergency ? `6 meses de tus gastos: ${suggestEmergency.toLocaleString("es-ES")} €` : undefined} />
        <SelectInput label="Dinero guardado en" value={accountId} onChange={setAccountId} emptyLabel="Lo indico a mano" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
        {!accountId && <MoneyInput label="Ahorrado hasta ahora" value={saved} onChange={setSaved} />}
        <TextInput label="Fecha objetivo" type="date" value={deadline} onChange={setDeadline} />
        <MoneyInput label="Aportación mensual" value={monthly} onChange={setMonthly} />
        <MoneyInput label="Rentabilidad anual esperada" value={ret} onChange={setRet} suffix="%" hint="0 si está en cuenta corriente; ~2 en remunerada." />
        <SelectInput label="Prioridad" value={priority} onChange={(v) => setPriority(v ?? "2")} options={[{ id: "1", label: "Alta" }, { id: "2", label: "Media" }, { id: "3", label: "Baja" }]} />
      </div>
      {goal && <SwitchField label="Meta conseguida" isSelected={done} onChange={setDone} />}
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}

function Simulator() {
  const money = useMoney();
  const nw = useNetWorth();
  const forecast = useForecast();
  const [initial, setInitial] = useState<number | null>(Math.round(nw.investments) || 1000);
  const [monthly, setMonthly] = useState<number | null>(Math.max(50, Math.round(Math.max(0, forecast.free + forecast.goals) / 50) * 50) || 300);
  const [years, setYears] = useState(20);
  const [inflation, setInflation] = useState(2.5);
  const [growth, setGrowth] = useState(2);
  const [real, setReal] = useState(true);
  const lines = useMemo(() => STRATEGIES.map((s) => ({ s, points: project({ initial: initial ?? 0, monthly: monthly ?? 0, annualReturn: s.annualReturn, years, inflation, contributionGrowth: growth }) })), [initial, monthly, years, inflation, growth]);
  const data = lines[0].points.map((_, i) => {
    const row: Record<string, number | string> = { year: `Año ${i}`, contributed: lines[0].points[i].contributed };
    for (const l of lines) row[l.s.id] = real ? l.points[i].real : l.points[i].value;
    return row;
  });
  return (
    <Card className="xl:col-span-3">
      <SectionTitle>Simulador de estrategias de ahorro</SectionTitle>
      <p className="text-sm text-muted">Compara cuánto acumularías con la misma aportación según dónde pongas el dinero. Rentabilidades históricas aproximadas y prudentes, no garantizadas.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MoneyInput label="Capital inicial" value={initial} onChange={setInitial} />
        <MoneyInput label="Aportación mensual" value={monthly} onChange={setMonthly} />
        <RangeField label="Años" value={years} onChange={setYears} min={1} max={45} />
        <RangeField label="Inflación" value={inflation} onChange={setInflation} min={0} max={6} step={0.5} valueLabel={`${inflation} %`} />
        <RangeField label="Subir aportación cada año" value={growth} onChange={setGrowth} min={0} max={10} step={0.5} valueLabel={`${growth} %`} />
        <SwitchField label="En dinero de hoy" hint="Descuenta la inflación" isSelected={real} onChange={setReal} />
      </div>
      <TimeChart
        ariaLabel="Proyección por estrategia"
        data={data}
        xKey="year"
        series={[...lines.map((l, i) => ({ key: l.s.id, label: `${l.s.label} (${l.s.annualReturn} %)`, color: series(i + 1) })), { key: "contributed", label: "Aportado", color: "var(--chart-muted)", dashed: true }]}
        format={(n) => money(n)}
        compactAxis={(n) => money(n, { compact: true })}
        height={300}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Resultado a {years} años por estrategia</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2">Estrategia</th>
              <th className="py-2 text-right">Rentab.</th>
              <th className="py-2 text-right">Volatilidad</th>
              <th className="py-2 text-right">Aportado</th>
              <th className="py-2 text-right">Resultado {real ? "(hoy)" : ""}</th>
              <th className="py-2 text-right">Intereses</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const last = l.points[l.points.length - 1];
              const value = real ? last.real : last.value;
              return (
                <tr key={l.s.id} className="border-t border-border">
                  <td className="py-2"><span className="font-bold">{l.s.label}</span><span className="block text-xs text-muted">{l.s.description}</span></td>
                  <td className="py-2 text-right tabular-nums">{l.s.annualReturn} %</td>
                  <td className="py-2 text-right tabular-nums">±{l.s.volatility} %</td>
                  <td className="py-2 text-right tabular-nums">{money(last.contributed)}</td>
                  <td className="py-2 text-right font-extrabold tabular-nums">{money(value)}</td>
                  <td className="py-2 text-right tabular-nums text-success">{money(last.value - last.contributed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SavingsScreen() {
  const today = useToday();
  const money = useMoney();
  const all = useCollection(goals);
  const goalSaved = useGoalSaved();
  const expenses = useAnnualExpenses();
  const nw = useNetWorth();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const active = all.filter((g) => !g.done).sort((a, b) => a.priority - b.priority);
  const done = all.filter((g) => g.done);
  const monthlyTotal = active.reduce((n, g) => n + g.monthlyContribution, 0);
  const emergencyMonths = expenses.annual > 0 ? nw.cash / (expenses.annual / 12) : null;

  return (
    <>
      <PageHeader title="Ahorro y metas" description="Tus objetivos con fecha: cuánto llevas, cuánto aportar y cuándo llegarás. Abajo, un simulador para comparar estrategias." actions={<Button onPress={() => setEditing("new")}><Plus size={16} aria-hidden="true" /> Nueva meta</Button>} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ahorrado en metas" value={money(active.reduce((n, g) => n + goalSaved(g), 0))} hint={`de ${money(active.reduce((n, g) => n + g.target, 0))}`} />
            <Stat label="Aportas al mes" value={money(monthlyTotal)} />
            <Stat label="Liquidez total" value={money(nw.cash)} />
            <Stat label="Colchón de emergencia" value={emergencyMonths != null ? `${formatNumber(emergencyMonths, 1)} meses` : "—"} hint="liquidez / gasto mensual" />
          </div>
        </Card>

        <div className="flex flex-col gap-3 xl:col-span-3">
          {active.length === 0 ? (
            <EmptyState icon={Target} title="Crea tu primera meta" description="Empieza por un fondo de emergencia de 3–6 meses de gastos; después, entrada de piso, viajes, coche…" action={<Button onPress={() => setEditing("new")}>Nueva meta</Button>} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {active.map((g) => {
                const saved = goalSaved(g);
                const months = g.deadline ? Math.max(1, diffMonths(monthOf(today), monthOf(g.deadline))) : null;
                const need = months != null ? requiredMonthly(saved, g.target, months, g.expectedReturn) : null;
                const eta = monthsToTarget(saved, g.monthlyContribution, g.expectedReturn, g.target);
                const behind = need != null && need > g.monthlyContribution * 1.05 && saved < g.target;
                return (
                  <li key={g.id} className="card gap-3">
                    <button type="button" className="flex items-start gap-3 text-left" onClick={() => setEditing(g)}>
                      <EmojiBadge emoji={g.emoji} color={g.color} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-extrabold">{g.name}</span>
                        <span className="block text-sm text-muted">{KIND_LABEL[g.kind]}{g.deadline ? ` · ${formatDay(g.deadline, "long")}` : ""}</span>
                      </span>
                      {behind ? <Chip size="sm" color="warning">Con retraso</Chip> : saved >= g.target ? <Chip size="sm" color="success">¡Conseguida!</Chip> : <Chip size="sm" color="success">En camino</Chip>}
                    </button>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black tabular-nums">{money(saved)}</span>
                        <span className="text-sm text-muted">de {money(g.target)}</span>
                      </div>
                      <Meter label={`Progreso de ${g.name}`} value={saved} max={g.target} tone={saved >= g.target ? "success" : behind ? "warning" : "accent"} />
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-surface-secondary p-2"><dt className="text-xs font-bold text-muted">Aportas</dt><dd className="font-extrabold">{money(g.monthlyContribution)}/mes</dd></div>
                      <div className="rounded-xl bg-surface-secondary p-2"><dt className="text-xs font-bold text-muted">{need != null ? "Necesitas" : "Llegarás en"}</dt><dd className={cn("font-extrabold", behind && "text-warning")}>{need != null ? `${money(need)}/mes` : formatYears(eta == null ? null : eta / 12)}</dd></div>
                    </dl>
                    {need == null && eta == null && <p className="text-xs text-muted">Añade una aportación mensual o una fecha para calcular el plan.</p>}
                    {need != null && eta != null && <p className="text-xs text-muted">A tu ritmo actual llegarías en {formatYears(eta / 12)}.</p>}
                    {!g.accountId && (
                      <Button size="sm" variant="secondary" className="self-start" onPress={async () => { const v = await promptMoney({ title: `Aportar a «${g.name}»`, label: "Importe" }); if (v) goals.update(g.id, { saved: g.saved + v }); }}>
                        <PiggyBank size={15} aria-hidden="true" /> Aportar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {done.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-muted">{done.length} metas conseguidas 🎉</summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {done.map((g) => (
                  <li key={g.id}><button type="button" onClick={() => setEditing(g)} className="chip">{g.emoji} {g.name} · {money(g.target)}</button></li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <Simulator />
      </div>
      {editing && <GoalModal key={editing === "new" ? "new" : editing.id} goal={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
