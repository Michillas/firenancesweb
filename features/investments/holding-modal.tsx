"use client";

import { Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, MoneyInput, Segmented, SelectInput, Spinner, TextAreaInput, TextInput, confirmAction, toast } from "@/components/ui";
import { ASSET_TYPES, PRICE_SOURCES, type AssetType, type Holding, type PriceSource } from "@/core/domain/finance";
import { CURRENCIES, type Currency } from "@/core/domain/settings";
import { priceIdOf } from "@/core/logic/networth";
import type { SearchResult } from "@/core/market/types";
import { fetchQuote, quoteBySource, refreshFeed, refreshQuotes, searchAssets } from "@/store/market";
import { useAccounts } from "@/store/selectors";
import { holdings, settings } from "@/store/stores";
import { ASSET_TYPE_LABEL, SOURCE_LABEL } from "./labels";

export function HoldingModal({ holding, onClose, onDeleted }: { holding: Holding | null; onClose: () => void; onDeleted?: () => void }) {
  const accounts = useAccounts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState(holding?.name ?? "");
  const [symbol, setSymbol] = useState(holding?.symbol ?? "");
  const [isin, setIsin] = useState(holding?.isin ?? "");
  const [assetType, setAssetType] = useState<AssetType>(holding?.assetType ?? "etf");
  const [priceSource, setPriceSource] = useState<PriceSource>(holding?.priceSource ?? "auto");
  const [priceId, setPriceId] = useState(holding?.priceId ?? "");
  const [mode, setMode] = useState<Holding["valuationMode"]>(holding?.valuationMode ?? "units");
  const [units, setUnits] = useState<number | null>(holding?.units ?? null);
  const [avgCost, setAvgCost] = useState<number | null>(holding?.avgCost ?? null);
  const [invested, setInvested] = useState<number | null>(holding?.invested ?? null);
  const [manualValue, setManualValue] = useState<number | null>(holding?.manualValue ?? null);
  const [manualPrice, setManualPrice] = useState<number | null>(holding?.manualPrice ?? null);
  const [currency, setCurrency] = useState<Currency>(holding?.currency ?? settings.get().currency);
  const [target, setTarget] = useState<number | null>(holding?.targetWeight ?? null);
  const [monthly, setMonthly] = useState<number | null>(holding?.monthlyContribution ?? null);
  const [region, setRegion] = useState(holding?.region ?? "");
  const [sector, setSector] = useState(holding?.sector ?? "");
  const [newsQuery, setNewsQuery] = useState(holding?.newsQuery ?? "");
  const [accountId, setAccountId] = useState<string | null>(holding?.accountId ?? null);
  const [notes, setNotes] = useState(holding?.notes ?? "");
  const [testing, setTesting] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchAssets(query.trim()));
    } catch {
      setResults([]);
      toast.warning("La búsqueda no está disponible ahora", { description: "Puedes rellenar los datos a mano." });
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: SearchResult) => {
    setName(r.name);
    setSymbol(r.symbol);
    setAssetType(r.assetType);
    setPriceSource(r.source);
    setPriceId(r.source === "coingecko" ? r.id : r.id !== r.symbol ? r.id : "");
    if (r.source === "nasdaq") setCurrency("USD");
    setResults(null);
    // Global listings trade in their own currency (Tokyo in JPY...): learn it from a first quote.
    if (r.source === "ftstock" || r.source === "yahoo") {
      void quoteBySource(r.source, r.id, currency)
        .then((q) => {
          if ((CURRENCIES as readonly string[]).includes(q.currency)) setCurrency(q.currency as Currency);
          toast.info(`${r.name}: ${q.price.toLocaleString("es-ES")} ${q.currency}`, { description: r.source === "ftstock" ? "Bolsas fuera de EE. UU.: datos gratuitos con ~15 min de retraso." : undefined });
        })
        .catch(() => undefined);
    }
  };

  const draft = (): Omit<Holding, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    isin: isin.trim().toUpperCase(),
    assetType,
    priceSource,
    priceId: priceId.trim(),
    valuationMode: mode,
    units: units ?? 0,
    avgCost: avgCost ?? 0,
    invested: invested ?? 0,
    manualPrice,
    manualValue,
    currency,
    accountId,
    targetWeight: target,
    monthlyContribution: monthly ?? 0,
    region,
    sector,
    newsQuery,
    notes,
    archived: holding?.archived ?? false,
  });

  const testPrice = async () => {
    const d = { ...draft(), id: "", createdAt: "", updatedAt: "" };
    if (!priceIdOf(d)) return toast.warning("Indica el ticker, el ISIN o el id del precio");
    setTesting(true);
    try {
      const q = await fetchQuote(d);
      toast.success(`${q.name || priceIdOf(d)}: ${q.price.toLocaleString("es-ES")} ${q.currency}`, { description: `Fuente: ${SOURCE_LABEL[q.source]}${q.currency !== currency ? ` · ojo: cotiza en ${q.currency}` : ""}` });
      if (!name.trim() && q.name) setName(q.name);
    } catch {
      toast.danger("No encontramos precio para ese ticker", { description: "Prueba con el ISIN, el formato de Yahoo (VWCE.DE, SAN.MC) o usa precio manual." });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    const d = draft();
    const saved = holding ? holdings.update(holding.id, d) : holdings.create(d);
    if (saved) {
      void refreshQuotes({ force: true });
      void refreshFeed(saved, true);
    }
    onClose();
  };

  const remove = async () => {
    if (!holding) return;
    if (await confirmAction({ title: `¿Eliminar «${holding.name}» de tu cartera?`, danger: true, confirmLabel: "Eliminar" })) {
      holdings.remove(holding.id);
      onClose();
      onDeleted?.();
    }
  };

  const valid = name.trim() && (mode === "units" ? (units ?? 0) > 0 : (manualValue ?? invested ?? 0) > 0);

  return (
    <AppModal
      isOpen
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={holding ? "Editar inversión" : "Añadir inversión"}
      footer={
        <>
          {holding && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={remove}>
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!valid} onPress={save}>Guardar</Button>
        </>
      }
    >
      {!holding && (
        <form className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-secondary/50 p-3" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <label className="text-sm font-bold" htmlFor="asset-search">Busca por nombre, ticker o ISIN</label>
          <div className="flex gap-2">
            <input id="asset-search" className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Vanguard All-World, AAPL, bitcoin…" />
            <Button type="submit" variant="secondary" isPending={searching} aria-label="Buscar">
              {!searching && <Search size={16} aria-hidden="true" />}
            </Button>
          </div>
          {searching && <Spinner size="sm" />}
          {results && (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {results.length === 0 && <li className="text-sm text-muted">Sin resultados. Rellena los datos a mano abajo.</li>}
              {results.map((r) => (
                <li key={`${r.source}:${r.id}`}>
                  <button type="button" onClick={() => pick(r)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{r.name}</span>
                      <span className="block text-xs text-muted">{r.symbol} · {ASSET_TYPE_LABEL[r.assetType]} · {r.exchange}</span>
                    </span>
                    <span className="chip chip-sm shrink-0">{SOURCE_LABEL[r.source]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Nombre" value={name} onChange={setName} className="sm:col-span-2" />
        <SelectInput label="Tipo de activo" value={assetType} onChange={(v) => v && setAssetType(v as AssetType)} options={ASSET_TYPES.map((t) => ({ id: t, label: ASSET_TYPE_LABEL[t] }))} />
        <TextInput label="Ticker" value={symbol} onChange={setSymbol} placeholder="VWCE.DE, AAPL, BTC" hint="Formato Yahoo para Europa (.DE, .AS, .MC). Con ISIN no hace falta." />
        <TextInput label="ISIN" value={isin} onChange={setIsin} placeholder="IE00BK5BQT80" hint="Para fondos y ETFs europeos: precio vía justETF / FT." />
        <SelectInput label="Moneda de la inversión" value={currency} onChange={(v) => v && setCurrency(v as Currency)} options={CURRENCIES.map((c) => ({ id: c, label: c }))} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">¿Cómo la valoramos?</span>
        <Segmented label="Valoración" value={mode} onChange={setMode} options={[{ id: "units", label: "Participaciones × precio" }, { id: "value", label: "Escribo el valor" }]} size="sm" className="self-start" />
      </div>
      {mode === "units" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MoneyInput label="Participaciones / unidades" value={units} onChange={setUnits} suffix="u." />
          <MoneyInput label="Precio medio de compra" value={avgCost} onChange={setAvgCost} suffix={currency} />
          <SelectInput label="Fuente del precio" value={priceSource} onChange={(v) => v && setPriceSource(v as PriceSource)} options={PRICE_SOURCES.map((s) => ({ id: s, label: SOURCE_LABEL[s] }))} />
          {priceSource === "manual" ? <MoneyInput label="Precio actual" value={manualPrice} onChange={setManualPrice} suffix={currency} /> : <TextInput label="Id del precio (opcional)" value={priceId} onChange={setPriceId} placeholder={assetType === "crypto" ? "bitcoin, ethereum…" : "si difiere del ticker"} />}
          <div className="flex items-end sm:col-span-2">
            <Button variant="secondary" onPress={testPrice} isPending={testing} isDisabled={priceSource === "manual"}>
              Comprobar precio
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput label="Total aportado" value={invested} onChange={setInvested} suffix={currency} />
          <MoneyInput label="Valor actual" value={manualValue} onChange={setManualValue} suffix={currency} hint="Actualízalo cuando mires tu bróker (o usa «buscar valor con IA» en la ficha)." />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MoneyInput label="Peso objetivo en la cartera" value={target} onChange={setTarget} suffix="%" hint="Para el rebalanceo." />
        <MoneyInput label="Aportación mensual" value={monthly} onChange={setMonthly} />
        <SelectInput label="Cuenta / bróker" value={accountId} onChange={setAccountId} emptyLabel="—" options={accounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
        <TextInput label="Región" value={region} onChange={setRegion} placeholder="Global, EE. UU., Europa…" />
        <TextInput label="Sector" value={sector} onChange={setSector} placeholder="Diversificado, tecnología…" />
        <TextInput label="Buscar noticias como" value={newsQuery} onChange={setNewsQuery} placeholder="por defecto: nombre + ticker" />
      </div>
      <TextAreaInput label="Notas / tesis de inversión" value={notes} onChange={setNotes} rows={2} />
    </AppModal>
  );
}
