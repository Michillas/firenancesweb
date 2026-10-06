"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, MoneyInput, Segmented, SelectInput, SwitchField, TextAreaInput, TextInput, confirmAction } from "@/components/ui";
import { CYCLES, type Cycle, type Recurring } from "@/core/domain/finance";
import { todayKey } from "@/core/logic/dates";
import { useAccounts, useCategories } from "@/store/selectors";
import { recurring, settings } from "@/store/stores";

export const CYCLE_LABEL: Record<Cycle, string> = { weekly: "Semanal", monthly: "Mensual", quarterly: "Trimestral", semiannual: "Semestral", yearly: "Anual" };
export const CYCLE_SHORT: Record<Cycle, string> = { weekly: "sem", monthly: "mes", quarterly: "trim", semiannual: "sem.", yearly: "año" };

export type RecurringDraft = Partial<Pick<Recurring, "name" | "amount" | "cycle" | "startDate" | "categoryId" | "accountId" | "kind">>;

export function RecurringModal({ item, draft, onClose }: { item: Recurring | null; draft?: RecurringDraft; onClose: () => void }) {
  const accounts = useAccounts();
  const [kind, setKind] = useState<Recurring["kind"]>(item?.kind ?? draft?.kind ?? "subscription");
  const cats = useCategories(kind === "income" ? "income" : "expense");
  const [name, setName] = useState(item?.name ?? draft?.name ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? (kind === "bill" ? "🧾" : "🔁"));
  const [amount, setAmount] = useState<number | null>(item?.amount ?? draft?.amount ?? null);
  const [cycle, setCycle] = useState<Cycle>(item?.cycle ?? draft?.cycle ?? "monthly");
  const [every, setEvery] = useState(item?.every ?? 1);
  const [startDate, setStartDate] = useState(item?.startDate ?? draft?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(item?.endDate ?? "");
  const [trialUntil, setTrialUntil] = useState(item?.trialUntil ?? "");
  const [accountId, setAccountId] = useState<string | null>(item?.accountId ?? draft?.accountId ?? accounts.find((a) => a.type === "checking")?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? draft?.categoryId ?? (kind === "subscription" ? "cat_subscriptions" : null));
  const [url, setUrl] = useState(item?.url ?? "");
  const [autoLog, setAutoLog] = useState(item?.autoLog ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");

  const save = () => {
    if (!name.trim() || amount == null) return;
    const row = { name: name.trim(), kind, emoji, amount, currency: item?.currency ?? settings.get().currency, cycle, every, startDate, endDate: endDate || null, trialUntil: trialUntil || null, accountId, categoryId, url, autoLog, notes };
    if (item) recurring.update(item.id, row);
    else recurring.create(row);
    onClose();
  };
  const remove = async () => {
    if (item && (await confirmAction({ title: `¿Eliminar «${item.name}»?`, body: "Los cobros ya registrados se conservan en Movimientos.", danger: true, confirmLabel: "Eliminar" }))) {
      recurring.remove(item.id);
      onClose();
    }
  };

  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={item ? "Editar recurrente" : "Nuevo cobro recurrente"}
      footer={
        <>
          {item && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={remove}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim() || amount == null} onPress={save}>Guardar</Button>
        </>
      }
    >
      <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setCategoryId(null); }} options={[{ id: "subscription", label: "Suscripción" }, { id: "bill", label: "Recibo" }, { id: "income", label: "Ingreso" }]} className="self-start" />
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextInput label="Emoji" value={emoji} onChange={setEmoji} />
        <TextInput label="Nombre" value={name} onChange={setName} placeholder={kind === "bill" ? "Alquiler, luz, seguro…" : kind === "income" ? "Alquiler que cobro, pensión…" : "Netflix, Spotify, gimnasio…"} autoFocus={!item} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Importe" value={amount} onChange={setAmount} />
        <SelectInput label="Frecuencia" value={cycle} onChange={(v) => v && setCycle(v as Cycle)} options={CYCLES.map((c) => ({ id: c, label: CYCLE_LABEL[c] }))} />
        <TextInput label={item ? "Fecha del primer cobro" : "Próximo cobro"} type="date" value={startDate} onChange={setStartDate} hint="Los siguientes se calculan a partir de esta fecha." />
        <TextInput label="Cada cuántos periodos" type="number" min={1} max={24} value={String(every)} onChange={(v) => setEvery(Math.max(1, Number(v) || 1))} />
        <SelectInput label="Cuenta de cargo" value={accountId} onChange={setAccountId} emptyLabel="Sin cuenta" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
        <SelectInput label="Categoría" value={categoryId} onChange={setCategoryId} emptyLabel="Sin categoría" options={cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))} />
        {kind === "subscription" && <TextInput label="Prueba gratis hasta" type="date" value={trialUntil} onChange={setTrialUntil} hint="Te avisamos antes de que empiece a cobrarse." />}
        <TextInput label="Termina el" type="date" value={endDate} onChange={setEndDate} hint="Opcional (fin de permanencia, último pago…)." />
      </div>
      {kind !== "income" && <TextInput label="Enlace para gestionar o cancelar" value={url} onChange={setUrl} placeholder="https://…" />}
      <SwitchField label="Registrar los cobros automáticamente" hint="Crea el movimiento el día del cobro (solo a partir de hoy)." isSelected={autoLog} onChange={setAutoLog} />
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}
