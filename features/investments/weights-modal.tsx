"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, MoneyInput, SelectInput, TextInput, toast } from "@/components/ui";
import { ASSET_TYPES, type AssetType } from "@/core/domain/finance";
import { refreshAllFeeds, refreshQuotes } from "@/store/market";
import { holdings, settings } from "@/store/stores";
import { ASSET_TYPE_LABEL } from "./labels";

interface Row {
  id: number;
  name: string;
  symbol: string;
  type: AssetType;
  pct: number | null;
}

// "I have 25.000 € split 70 % world, 20 % EM, 10 % bitcoin": builds the portfolio from percentages.
export function WeightsModal({ onClose }: { onClose: () => void }) {
  const [total, setTotal] = useState<number | null>(null);
  const [invested, setInvested] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "", symbol: "", type: "index_fund", pct: null },
    { id: 2, name: "", symbol: "", type: "etf", pct: null },
  ]);
  const sum = rows.reduce((n, r) => n + (r.pct ?? 0), 0);
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const valid = (total ?? 0) > 0 && rows.some((r) => r.name.trim() && r.pct) && Math.abs(sum - 100) < 0.6;

  const save = () => {
    const currency = settings.get().currency;
    const ratio = invested && total ? invested / total : 1;
    for (const r of rows) {
      if (!r.name.trim() || !r.pct) continue;
      const value = ((total ?? 0) * r.pct) / 100;
      holdings.create({ name: r.name.trim(), symbol: r.symbol.trim().toUpperCase(), assetType: r.type, valuationMode: "value", manualValue: Math.round(value * 100) / 100, invested: Math.round(value * ratio * 100) / 100, currency, targetWeight: r.pct });
    }
    toast.success("Cartera creada", { description: "Cada posición usa «escribo el valor». Si añades participaciones y ticker, se actualizará sola." });
    void refreshQuotes();
    void refreshAllFeeds();
    onClose();
  };

  return (
    <AppModal isOpen size="lg" onOpenChange={(o) => !o && onClose()} title="Crear cartera por porcentajes" footer={<><Button variant="tertiary" onPress={onClose}>Cancelar</Button><Button isDisabled={!valid} onPress={save}>Crear posiciones</Button></>}>
      <p className="text-sm text-muted">Escribe el valor total de tu cartera y el porcentaje de cada fondo, ETF, acción o cripto. Puedes afinar participaciones y tickers después para que el precio se actualice solo y lleguen las noticias.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Valor total actual" value={total} onChange={setTotal} />
        <MoneyInput label="Total aportado (opcional)" value={invested} onChange={setInvested} hint="Para calcular la rentabilidad." />
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_7rem_10rem_6rem_auto]">
            <TextInput label="Nombre" value={r.name} onChange={(name) => update(r.id, { name })} className="col-span-2 sm:col-span-1" />
            <TextInput label="Ticker" value={r.symbol} onChange={(symbol) => update(r.id, { symbol })} />
            <SelectInput label="Tipo" value={r.type} onChange={(v) => v && update(r.id, { type: v as AssetType })} options={ASSET_TYPES.map((t) => ({ id: t, label: ASSET_TYPE_LABEL[t] }))} />
            <MoneyInput label="%" value={r.pct} onChange={(pct) => update(r.id, { pct })} suffix="%" />
            <Button isIconOnly variant="ghost" aria-label="Quitar fila" onPress={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onPress={() => setRows((rs) => [...rs, { id: Date.now(), name: "", symbol: "", type: "etf", pct: null }])}>
          <Plus size={14} aria-hidden="true" /> Añadir fila
        </Button>
        <span className={Math.abs(sum - 100) < 0.6 ? "font-bold text-success" : "font-bold text-warning"}>Suma: {sum.toLocaleString("es-ES")} %</span>
      </div>
    </AppModal>
  );
}
