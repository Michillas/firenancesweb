"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, MoneyInput, Segmented, SelectInput, SwitchField, TextAreaInput, TextInput, confirmAction } from "@/components/ui";
import { ASSET_CATEGORIES, type OtherAsset } from "@/core/domain/finance";
import { assets } from "@/store/stores";

export const ASSET_CATEGORY_LABEL: Record<(typeof ASSET_CATEGORIES)[number], string> = {
  real_estate: "Inmueble",
  vehicle: "Vehículo",
  valuables: "Objetos de valor",
  receivable: "Dinero que te deben",
  business: "Empresa / participaciones",
  other_asset: "Otro bien",
  mortgage: "Hipoteca",
  loan: "Préstamo",
  credit_card: "Tarjeta de crédito",
  other_debt: "Otra deuda",
};
const ASSET_CATS = ASSET_CATEGORIES.slice(0, 6);
const DEBT_CATS = ASSET_CATEGORIES.slice(6);
const EMOJI: Record<string, string> = { real_estate: "🏠", vehicle: "🚗", valuables: "💍", receivable: "🤝", business: "🏢", other_asset: "📦", mortgage: "🏦", loan: "💳", credit_card: "💳", other_debt: "🧾" };

export function AssetModal({ asset, defaultKind, onClose }: { asset: OtherAsset | null; defaultKind: OtherAsset["kind"]; onClose: () => void }) {
  const [kind, setKind] = useState(asset?.kind ?? defaultKind);
  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState<OtherAsset["category"]>(asset?.category ?? (defaultKind === "asset" ? "real_estate" : "mortgage"));
  const [value, setValue] = useState<number | null>(asset?.value ?? null);
  const [rate, setRate] = useState<number | null>(asset?.interestRate ?? null);
  const [payment, setPayment] = useState<number | null>(asset?.monthlyPayment ?? null);
  const [endDate, setEndDate] = useState(asset?.endDate ?? "");
  const [fire, setFire] = useState(asset?.includeInFire ?? false);
  const [notes, setNotes] = useState(asset?.notes ?? "");

  const save = () => {
    const row = { name: name.trim(), kind, category, value: value ?? 0, interestRate: rate ?? 0, monthlyPayment: payment ?? 0, endDate: endDate || null, includeInFire: kind === "asset" && fire, emoji: EMOJI[category] ?? "📦", notes };
    if (asset) assets.update(asset.id, row);
    else assets.create(row);
    onClose();
  };
  const remove = async () => {
    if (asset && (await confirmAction({ title: `¿Eliminar «${asset.name}»?`, danger: true, confirmLabel: "Eliminar" }))) {
      assets.remove(asset.id);
      onClose();
    }
  };
  const cats = kind === "asset" ? ASSET_CATS : DEBT_CATS;

  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={asset ? "Editar" : kind === "asset" ? "Nuevo bien" : "Nueva deuda"}
      footer={
        <>
          {asset && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={remove}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim() || value == null} onPress={save}>Guardar</Button>
        </>
      }
    >
      <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setCategory(k === "asset" ? "real_estate" : "mortgage"); }} options={[{ id: "asset", label: "Bien" }, { id: "liability", label: "Deuda" }]} className="self-start" />
      <TextInput label="Nombre" value={name} onChange={setName} placeholder={kind === "asset" ? "Piso en Valencia, coche…" : "Hipoteca, préstamo coche…"} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput label="Categoría" value={category} onChange={(v) => v && setCategory(v as OtherAsset["category"])} options={cats.map((c) => ({ id: c, label: ASSET_CATEGORY_LABEL[c] }))} />
        <MoneyInput label={kind === "asset" ? "Valor actual" : "Pendiente de pagar"} value={value} onChange={setValue} />
        {kind === "liability" ? (
          <>
            <MoneyInput label="Interés anual" value={rate} onChange={setRate} suffix="%" />
            <MoneyInput label="Cuota mensual" value={payment} onChange={setPayment} />
            <TextInput label="Fecha de fin" type="date" value={endDate} onChange={setEndDate} />
          </>
        ) : (
          <MoneyInput label="Revalorización anual estimada" value={rate} onChange={setRate} suffix="%" allowNegative hint="Negativa para un coche (se deprecia)." />
        )}
      </div>
      {kind === "asset" && <SwitchField label="Cuenta para FIRE" hint="Activa si este bien te generará ingresos o lo venderás (no tu vivienda habitual)." isSelected={fire} onChange={setFire} />}
      {kind === "liability" && payment ? <p className="text-sm text-muted">Consejo: añade la cuota como recurrente en Suscripciones (tipo «recibo») para que entre en tus previsiones.</p> : null}
      <TextAreaInput label="Notas" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}
