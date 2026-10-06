"use client";

import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, MoneyInput, SelectInput, SwitchField, TextAreaInput, TextInput, confirmAction } from "@/components/ui";
import { ACCOUNT_TYPES, type Account, type AccountType } from "@/core/domain/finance";
import { CURRENCIES, type Currency } from "@/core/domain/settings";
import { todayKey } from "@/core/logic/dates";
import { PALETTE } from "@/lib/colors";
import { setAccountBalance } from "@/store/actions/finance";
import { accounts, settings } from "@/store/stores";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Cuenta corriente",
  savings: "Ahorro / remunerada",
  cash: "Efectivo",
  broker: "Bróker (efectivo)",
  crypto: "Exchange cripto (efectivo)",
  pension: "Plan de pensiones (efectivo)",
  other: "Otra",
};
const TYPE_EMOJI: Record<AccountType, string> = { checking: "🏦", savings: "💶", cash: "👛", broker: "📈", crypto: "🪙", pension: "🧓", other: "💼" };

export function AccountModal({ account, balance, onClose }: { account: Account | null; balance: number; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [emoji, setEmoji] = useState(account?.emoji ?? "🏦");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? settings.get().currency);
  const [value, setValue] = useState<number | null>(account ? Math.round(balance * 100) / 100 : null);
  const [interest, setInterest] = useState<number | null>(account?.interestRate ?? null);
  const [include, setInclude] = useState(account?.includeInNetWorth ?? true);
  const [color, setColor] = useState(account?.color ?? "sky");
  const [notes, setNotes] = useState(account?.notes ?? "");

  const save = () => {
    const row = { name: name.trim(), type, emoji: emoji || TYPE_EMOJI[type], institution, currency, interestRate: interest ?? 0, includeInNetWorth: include, color, notes };
    if (account) {
      const updated = accounts.update(account.id, row);
      if (updated && value != null && Math.abs(value - balance) > 0.004) setAccountBalance(updated, value);
    } else {
      accounts.create({ ...row, openingBalance: value ?? 0, openingDate: todayKey() });
    }
    onClose();
  };

  const archive = async () => {
    if (!account) return;
    if (await confirmAction({ title: `¿Archivar «${account.name}»?`, body: "Deja de sumar al patrimonio pero conserva sus movimientos.", confirmLabel: "Archivar" })) {
      accounts.update(account.id, { archived: !account.archived });
      onClose();
    }
  };

  const remove = async () => {
    if (!account) return;
    if (await confirmAction({ title: `¿Eliminar «${account.name}»?`, body: "Los movimientos se quedan sin cuenta asignada.", danger: true, confirmLabel: "Eliminar" })) {
      accounts.remove(account.id);
      onClose();
    }
  };

  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={account ? "Editar cuenta" : "Nueva cuenta"}
      footer={
        <>
          {account && (
            <span className="mr-auto flex gap-1">
              <Button variant="ghost" onPress={archive}>
                <Archive size={15} aria-hidden="true" /> {account.archived ? "Reactivar" : "Archivar"}
              </Button>
              <Button variant="ghost" className="text-danger" onPress={remove} aria-label="Eliminar cuenta">
                <Trash2 size={15} aria-hidden="true" />
              </Button>
            </span>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim()} onPress={save}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextInput label="Emoji" value={emoji} onChange={setEmoji} />
        <TextInput label="Nombre" value={name} onChange={setName} placeholder="BBVA nómina, Cuenta naranja…" autoFocus />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput label="Tipo" value={type} onChange={(v) => { const t = (v as AccountType) ?? "checking"; setType(t); if (!account) setEmoji(TYPE_EMOJI[t]); }} options={ACCOUNT_TYPES.map((t) => ({ id: t, label: ACCOUNT_TYPE_LABEL[t] }))} />
        <TextInput label="Entidad" value={institution} onChange={setInstitution} placeholder="Opcional" />
        <MoneyInput label={account ? "Saldo actual" : "Saldo de hoy"} value={value} onChange={setValue} allowNegative suffix={currency} hint={account ? "Si lo cambias, ajustamos la cuenta para cuadrar con tu banco." : "Los movimientos que añadas a partir de hoy lo irán actualizando."} />
        <SelectInput label="Moneda" value={currency} onChange={(v) => v && setCurrency(v as Currency)} options={CURRENCIES.map((c) => ({ id: c, label: c }))} />
        {(type === "savings" || type === "checking") && <MoneyInput label="Interés anual (TAE)" value={interest} onChange={setInterest} suffix="%" />}
        <SelectInput label="Color" value={color} onChange={(v) => v && setColor(v)} options={PALETTE.map((p) => ({ id: p.id, label: p.id }))} />
      </div>
      <SwitchField label="Sumar al patrimonio" isSelected={include} onChange={setInclude} />
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}
