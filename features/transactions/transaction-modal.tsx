"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal, Button, MoneyInput, Segmented, SelectInput, SwitchField, TextAreaInput, TextInput, confirmAction, toast } from "@/components/ui";
import type { TxKind } from "@/core/domain/finance";
import { guessCategory, learnRules } from "@/core/logic/categorize";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useAccounts, useCategories } from "@/store/selectors";
import { settings, transactions } from "@/store/stores";
import { closeTransaction, useUi } from "@/store/ui";

function TransactionModal({ id, initialKind }: { id: string | null; initialKind: TxKind }) {
  const today = useToday();
  const existing = id ? transactions.get(id) : undefined;
  const accounts = useAccounts();
  const all = useCollection(transactions);
  const [kind, setKind] = useState<TxKind>(existing?.kind ?? initialKind);
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [date, setDate] = useState(existing?.date ?? today);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [touchedCategory, setTouchedCategory] = useState(Boolean(existing?.categoryId));
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? accounts.find((a) => a.type === "checking")?.id ?? accounts[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [excluded, setExcluded] = useState(existing?.excluded ?? false);
  const cats = useCategories(kind === "income" ? "income" : "expense");
  const rules = useMemo(() => learnRules(all), [all]);

  // Suggest a category from the description until the user picks one.
  const suggested = !touchedCategory && kind !== "transfer" && description.trim().length > 2 ? guessCategory({ description, kind }, cats, rules) : null;
  const effectiveCategory = touchedCategory ? categoryId : (suggested ?? categoryId);

  const valid = amount != null && amount > 0 && description.trim() && date && (kind !== "transfer" || (accountId && toAccountId && accountId !== toAccountId));

  const save = () => {
    if (!valid) return;
    const row = {
      date,
      amount: amount!,
      kind,
      currency: accounts.find((a) => a.id === accountId)?.currency ?? settings.get().currency,
      accountId,
      toAccountId: kind === "transfer" ? toAccountId : null,
      categoryId: kind === "transfer" ? null : effectiveCategory,
      description: description.trim(),
      merchant: existing?.merchant ?? "",
      notes,
      tags: existing?.tags ?? [],
      source: existing?.source ?? ("manual" as const),
      recurringId: existing?.recurringId ?? null,
      excluded,
    };
    if (existing) transactions.update(existing.id, row);
    else transactions.create(row);
    toast.success(existing ? "Movimiento actualizado" : "Movimiento añadido");
    closeTransaction();
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirmAction({ title: `¿Eliminar «${existing.description}»?`, danger: true, confirmLabel: "Eliminar" }))) return;
    transactions.remove(existing.id);
    closeTransaction();
  };

  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && closeTransaction()}
      title={existing ? "Editar movimiento" : "Nuevo movimiento"}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={remove}>
              <Trash2 size={16} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={closeTransaction}>
            Cancelar
          </Button>
          <Button isDisabled={!valid} onPress={save}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Segmented
          label="Tipo"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId(null);
            setTouchedCategory(false);
          }}
          options={[
            { id: "expense", label: "Gasto" },
            { id: "income", label: "Ingreso" },
            { id: "transfer", label: "Traspaso" },
          ]}
          className="self-start"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput label="Importe" value={amount} onChange={setAmount} autoFocus={!existing} />
          <TextInput label="Fecha" type="date" value={date} onChange={setDate} />
        </div>
        <TextInput label="Concepto" value={description} onChange={setDescription} placeholder={kind === "income" ? "Nómina, Bizum de Ana…" : "Mercadona, cena con amigos…"} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput label={kind === "transfer" ? "Desde la cuenta" : "Cuenta"} value={accountId} onChange={setAccountId} emptyLabel="Sin cuenta" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
          {kind === "transfer" ? (
            <SelectInput label="A la cuenta" value={toAccountId} onChange={setToAccountId} placeholder="Elige cuenta" options={accounts.filter((a) => a.id !== accountId).map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
          ) : (
            <SelectInput
              label={suggested && !touchedCategory ? "Categoría (sugerida)" : "Categoría"}
              value={effectiveCategory}
              onChange={(v) => {
                setCategoryId(v);
                setTouchedCategory(true);
              }}
              emptyLabel="Sin categoría"
              options={cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))}
            />
          )}
        </div>
        <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
        <SwitchField label="Excluir de las estadísticas" hint="Para devoluciones entre amigos, gastos compartidos que te reembolsan, etc." isSelected={excluded} onChange={setExcluded} />
        <button type="submit" className="sr-only">Guardar</button>
      </form>
    </AppModal>
  );
}

export function TransactionHost() {
  const tx = useUi((s) => s.tx);
  return tx.open ? <TransactionModal key={tx.nonce} id={tx.id} initialKind={tx.kind} /> : null;
}
