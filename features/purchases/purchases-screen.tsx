"use client";

import { Check, ExternalLink, PiggyBank, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal, Button, Card, Chip, EmptyState, Meter, MoneyInput, PageHeader, SectionTitle, Segmented, SelectInput, Stat, SwitchField, TextAreaInput, TextInput, confirmAction, promptMoney, toast } from "@/components/ui";
import type { Purchase } from "@/core/domain/finance";
import { diffDays } from "@/core/logic/dates";
import { installmentPayment, purchaseMonthly, schedulePurchases } from "@/core/logic/forecast";
import { estimatePayroll } from "@/core/logic/payroll";
import { cn } from "@/lib/cn";
import { formatDay, formatMonth } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useDoc } from "@/store/create-doc-store";
import { useAccounts, useCategories, useForecast, useMoney } from "@/store/selectors";
import { plan, purchases, settings, transactions } from "@/store/stores";

const PRIORITY = { 1: "Alta", 2: "Media", 3: "Baja" } as const;

function PurchaseModal({ item, onClose }: { item: Purchase | null; onClose: () => void }) {
  const cats = useCategories("expense");
  const [name, setName] = useState(item?.name ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "🛍️");
  const [price, setPrice] = useState<number | null>(item?.price ?? null);
  const [saved, setSaved] = useState<number | null>(item?.saved ?? null);
  const [targetDate, setTargetDate] = useState(item?.targetDate ?? "");
  const [priority, setPriority] = useState(String(item?.priority ?? 2) as "1" | "2" | "3");
  const [need, setNeed] = useState(item?.need ?? false);
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? "cat_shopping");
  const [url, setUrl] = useState(item?.url ?? "");
  const [installments, setInstallments] = useState(item?.installments ?? 0);
  const [apr, setApr] = useState<number | null>(item?.apr ?? 0);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const save = () => {
    const row = { name: name.trim(), emoji, price: price ?? 0, saved: saved ?? 0, targetDate: targetDate || null, priority: Number(priority), need, categoryId, url, installments, apr: apr ?? 0, notes };
    if (item) purchases.update(item.id, row);
    else purchases.create(row);
    onClose();
  };
  const monthly = installments > 0 && price ? installmentPayment(price - (saved ?? 0), installments, apr ?? 0) : null;
  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={item ? "Editar compra" : "Planear una compra"}
      footer={
        <>
          {item && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={async () => { if (await confirmAction({ title: `¿Eliminar «${item.name}»?`, danger: true, confirmLabel: "Eliminar" })) { purchases.remove(item.id); onClose(); } }}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim() || !price} onPress={save}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextInput label="Emoji" value={emoji} onChange={setEmoji} />
        <TextInput label="¿Qué quieres comprar?" value={name} onChange={setName} autoFocus={!item} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Precio" value={price} onChange={setPrice} />
        <MoneyInput label="Ya ahorrado para esto" value={saved} onChange={setSaved} />
        <TextInput label="¿Para cuándo?" type="date" value={targetDate} onChange={setTargetDate} />
        <SelectInput label="Categoría" value={categoryId} onChange={setCategoryId} emptyLabel="—" options={cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Prioridad</span>
        <Segmented label="Prioridad" value={priority} onChange={setPriority} options={[{ id: "1", label: "Alta" }, { id: "2", label: "Media" }, { id: "3", label: "Baja" }]} size="sm" className="self-start" />
      </div>
      <SwitchField label="Es una necesidad" hint="Los caprichos pasan por la regla de los 30 días antes de comprarlos." isSelected={need} onChange={setNeed} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Pagar a plazos (meses, 0 = al contado)" type="number" min={0} max={120} value={String(installments)} onChange={(v) => setInstallments(Math.max(0, Number(v) || 0))} />
        {installments > 0 && <MoneyInput label="TAE / TIN de la financiación" value={apr} onChange={setApr} suffix="%" hint={monthly ? `Cuota: ${monthly.toFixed(2)} € · intereses ${(monthly * installments - ((price ?? 0) - (saved ?? 0))).toFixed(2)} €` : undefined} />}
      </div>
      <TextInput label="Enlace" value={url} onChange={setUrl} placeholder="https://…" />
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}

export function PurchasesScreen() {
  const today = useToday();
  const money = useMoney();
  const items = useCollection(purchases);
  const accounts = useAccounts();
  const p = useDoc(plan);
  const forecast = useForecast();
  const [editing, setEditing] = useState<Purchase | "new" | null>(null);
  const [tab, setTab] = useState<"planned" | "done">("planned");
  const planned = items.filter((x) => x.status === "planned");
  const done = items.filter((x) => x.status !== "planned").sort((a, b) => (b.boughtAt ?? b.updatedAt).localeCompare(a.boughtAt ?? a.updatedAt));
  const available = Math.max(0, forecast.free + forecast.purchases);
  const schedule = useMemo(() => schedulePurchases(items, available, today), [items, available, today]);
  const net = estimatePayroll(p.payroll);
  const hourly = net.netAnnual > 0 ? net.netAnnual / 1760 : null;
  const totalMissing = planned.reduce((n, x) => n + Math.max(0, x.price - x.saved), 0);

  const markBought = async (x: Purchase) => {
    const ok = await confirmAction({ title: `¿Has comprado «${x.name}»?`, body: `Se registrará un gasto de ${money(x.price)} hoy en tu cuenta principal.`, confirmLabel: "Sí, registrar" });
    if (!ok) return;
    transactions.create({ date: today, amount: x.price, kind: "expense", currency: settings.get().currency, accountId: accounts.find((a) => a.type === "checking")?.id ?? null, toAccountId: null, categoryId: x.categoryId, description: x.name, merchant: "", notes: "Compra planeada", tags: [], source: "manual", recurringId: null, excluded: false });
    purchases.update(x.id, { status: "bought", boughtAt: today, saved: x.price });
    toast.success("¡Disfrútalo! Compra registrada");
  };

  const addSaving = async (x: Purchase) => {
    const amount = await promptMoney({ title: `Apartar dinero para «${x.name}»`, label: "Importe" });
    if (amount) purchases.update(x.id, { saved: Math.min(x.price, x.saved + amount) });
  };

  return (
    <>
      <PageHeader title="Compras planeadas" description="Tu lista de deseos con cabeza: cuánto apartar al mes, cuándo podrás pagarlo sin tocar tus metas y cuánto te cuesta de verdad." actions={<Button onPress={() => setEditing("new")}><Plus size={16} aria-hidden="true" /> Planear compra</Button>} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Por comprar" value={money(planned.reduce((n, x) => n + x.price, 0))} hint={`${planned.length} compras`} />
            <Stat label="Falta por ahorrar" value={money(totalMissing)} />
            <Stat label="Apartar al mes" value={money(forecast.purchases)} hint="según fechas objetivo" />
            <Stat label="Margen mensual disponible" value={money(available)} hint="lo libre antes de compras" />
          </div>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <Segmented label="Mostrar" value={tab} onChange={setTab} options={[{ id: "planned", label: `Pendientes (${planned.length})` }, { id: "done", label: `Historial (${done.length})` }]} className="self-start" />
          {tab === "planned" && planned.length === 0 && <EmptyState icon={ShoppingBag} title="Nada en la lista" description="Apunta lo que quieres comprar: te diremos cuánto apartar y cuándo podrás permitírtelo." action={<Button onPress={() => setEditing("new")}>Planear compra</Button>} />}
          <ul className="flex flex-col gap-3">
            {(tab === "planned" ? schedule.map((s) => s.purchase) : done).map((x) => {
              const s = schedule.find((y) => y.purchase.id === x.id);
              const days = diffDays(x.createdAt.slice(0, 10), today);
              const cooling = !x.need && x.status === "planned" && days < 30;
              return (
                <li key={x.id} className={cn("card gap-3", x.status !== "planned" && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-secondary text-2xl" aria-hidden="true">{x.emoji}</span>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(x)}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-extrabold">{x.name}</span>
                        <Chip size="sm" color={x.priority === 1 ? "danger" : x.priority === 2 ? "warning" : "default"}>Prioridad {PRIORITY[x.priority as 1 | 2 | 3].toLowerCase()}</Chip>
                        <Chip size="sm" color={x.need ? "accent" : "default"}>{x.need ? "Necesidad" : "Capricho"}</Chip>
                        {x.status === "bought" && <Chip size="sm" color="success">Comprado {x.boughtAt ? formatDay(x.boughtAt) : ""}</Chip>}
                        {x.status === "discarded" && <Chip size="sm">Descartado</Chip>}
                      </span>
                      <span className="block text-sm text-muted">
                        {x.targetDate ? `Para el ${formatDay(x.targetDate, "long")}` : "Sin fecha"}
                        {x.installments > 0 && ` · ${x.installments} cuotas de ${money(installmentPayment(x.price - x.saved, x.installments, x.apr))}`}
                        {hourly && ` · equivale a ${Math.round(x.price / hourly)} h de tu trabajo`}
                      </span>
                    </button>
                    <span className="text-right">
                      <span className="block text-xl font-black tabular-nums">{money(x.price)}</span>
                      {x.url && (
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-accent">
                          Ver <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </span>
                  </div>
                  {x.status === "planned" && (
                    <>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">{money(x.saved)} ahorrado</span>
                          <span className="text-muted">faltan {money(Math.max(0, x.price - x.saved))}</span>
                        </div>
                        <Meter label={`Ahorrado para ${x.name}`} value={x.saved} max={x.price} tone={x.saved >= x.price ? "success" : "accent"} />
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <p className="rounded-xl bg-surface-secondary p-2"><span className="block text-xs font-bold text-muted">Apartar al mes</span><span className="font-extrabold">{money(purchaseMonthly(x, today))}</span></p>
                        <p className="rounded-xl bg-surface-secondary p-2"><span className="block text-xs font-bold text-muted">Podrías pagarlo en</span><span className={cn("font-extrabold", s?.onTime === false && "text-warning")}>{s?.fundedMonth ? (s.monthsNeeded === 0 ? "ya" : formatMonth(s.fundedMonth)) : "más de 5 años"}</span></p>
                        <p className="rounded-xl bg-surface-secondary p-2"><span className="block text-xs font-bold text-muted">Invertido 10 años al 7 %</span><span className="font-extrabold">{money(x.price * Math.pow(1.07, 10))}</span></p>
                      </div>
                      {cooling && <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold">Regla de los 30 días: espera {30 - days} días más antes de comprarlo. Si sigues queriéndolo, adelante.</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onPress={() => void addSaving(x)}><PiggyBank size={15} aria-hidden="true" /> Apartar dinero</Button>
                        <Button size="sm" variant="success" onPress={() => void markBought(x)}><Check size={15} aria-hidden="true" /> Comprado</Button>
                        <Button size="sm" variant="ghost" onPress={() => purchases.update(x.id, { status: "discarded" })}><X size={15} aria-hidden="true" /> Ya no lo quiero</Button>
                      </div>
                    </>
                  )}
                  {x.status === "discarded" && (
                    <p className="text-sm text-success">Te has ahorrado {money(x.price)}. <button type="button" className="font-bold text-accent" onClick={() => purchases.update(x.id, { status: "planned" })}>Recuperar</button></p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle>Orden de compra</SectionTitle>
            <p className="text-sm text-muted">Si destinas tu margen libre ({money(available)}/mes) a la lista por prioridad:</p>
            <ol className="flex flex-col gap-1.5 text-sm">
              {schedule.map((s, i) => (
                <li key={s.purchase.id} className="flex items-center justify-between gap-2">
                  <span className="truncate"><span className="font-bold text-muted">{i + 1}.</span> {s.purchase.emoji} {s.purchase.name}</span>
                  <span className={cn("shrink-0 font-bold", s.onTime === false && "text-warning")}>{s.fundedMonth ? (s.monthsNeeded === 0 ? "ya" : formatMonth(s.fundedMonth, "long")) : "—"}</span>
                </li>
              ))}
              {schedule.length === 0 && <li className="text-muted">Lista vacía.</li>}
            </ol>
          </Card>
          <Card>
            <SectionTitle>Antes de comprar</SectionTitle>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              <li>¿Lo pagarías al contado? Si no, revisa el coste real de los plazos.</li>
              <li>Convierte el precio en horas de trabajo{hourly ? ` (tu hora neta ≈ ${money(hourly)})` : ""}.</li>
              <li>Para caprichos, espera 30 días: la mayoría de ganas desaparecen.</li>
              <li>Primero el fondo de emergencia; después, los deseos.</li>
            </ul>
          </Card>
        </div>
      </div>
      {editing && <PurchaseModal key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
