"use client";

import { FileSpreadsheet, FileText, LineChart, Sparkles, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, CheckboxField, Chip, PageHeader, SectionTitle, Segmented, SelectInput, Spinner, TextAreaInput, toast } from "@/components/ui";
import type { AiHolding } from "@/core/ai";
import { closingBalance, detectMapping, parseCsv, rowsToDrafts } from "@/core/logic/csv";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { extractPdfText } from "@/lib/pdf";
import { aiExtractHoldings, aiExtractTransactions } from "@/store/actions/ai";
import { commitImport, prepareImport, setAccountBalance, type PreparedRow } from "@/store/actions/finance";
import { refreshAllFeeds, refreshQuotes } from "@/store/market";
import { useAccounts, useCategories, useMoney } from "@/store/selectors";
import { accounts, holdings, settings } from "@/store/stores";
import { ASSET_TYPE_LABEL } from "../investments/labels";

type Mode = "movements" | "portfolio";

async function readFile(file: File): Promise<{ text: string; kind: "csv" | "pdf" | "text" }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return { text: await extractPdfText(file), kind: "pdf" };
  const text = await file.text();
  return { text, kind: name.endsWith(".csv") || name.endsWith(".tsv") || (text.split("\n")[0]?.split(/[;,\t]/).length ?? 0) >= 3 ? "csv" : "text" };
}

function Review({ rows, setRows, closing, source, onDone }: { rows: PreparedRow[]; setRows: (r: PreparedRow[]) => void; closing: number | null; source: "ai" | "csv"; onDone: () => void }) {
  const money = useMoney();
  const cats = useCategories();
  const accs = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(rows.find((r) => r.accountId)?.accountId ?? null);
  const [applyBalance, setApplyBalance] = useState(closing != null);
  const selected = rows.filter((r) => r.include);
  const income = selected.filter((r) => r.draft.kind === "income").reduce((n, r) => n + r.draft.amount, 0);
  const expense = selected.filter((r) => r.draft.kind === "expense").reduce((n, r) => n + r.draft.amount, 0);
  const set = (i: number, patch: Partial<PreparedRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const commit = () => {
    const n = commitImport(rows.map((r) => ({ ...r, accountId: r.accountId ?? accountId })), source);
    if (applyBalance && closing != null && accountId) {
      const acc = accounts.get(accountId);
      if (acc) setAccountBalance(acc, closing);
    }
    toast.success(`${n} movimientos importados`);
    onDone();
  };

  return (
    <Card className="gap-4">
      <SectionTitle>Revisa antes de guardar</SectionTitle>
      <div className="flex flex-wrap items-end gap-4">
        <SelectInput className="min-w-64" label="Cuenta de estos movimientos" value={accountId} onChange={(v) => { setAccountId(v); setRows(rows.map((r) => ({ ...r, accountId: v }))); }} emptyLabel="Sin cuenta" options={accs.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />
        <p className="text-sm text-muted">
          {selected.length} de {rows.length} seleccionados · ingresos <span className="font-bold text-success">{money(income)}</span> · gastos <span className="font-bold">{money(expense)}</span>
          {rows.some((r) => r.duplicate) && ` · ${rows.filter((r) => r.duplicate).length} posibles duplicados desmarcados`}
        </p>
      </div>
      {closing != null && (
        <CheckboxField label={`Ajustar el saldo de la cuenta al del extracto (${money(closing)})`} isSelected={applyBalance && Boolean(accountId)} onChange={setApplyBalance} />
      )}
      <div className="-mx-2 max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Movimientos detectados</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-2 py-2"><span className="sr-only">Incluir</span></th>
              <th className="px-2 py-2">Fecha</th>
              <th className="px-2 py-2">Concepto</th>
              <th className="px-2 py-2">Categoría</th>
              <th className="px-2 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn("border-t border-border", !r.include && "opacity-50")}>
                <td className="px-2 py-1.5"><CheckboxField label={`Incluir ${r.draft.description}`} hideLabel isSelected={r.include} onChange={(v) => set(i, { include: v })} /></td>
                <td className="whitespace-nowrap px-2 py-1.5">{formatDay(r.draft.date, "long")}</td>
                <td className="px-2 py-1.5">
                  <span className="block font-semibold">{r.draft.merchant || r.draft.description}</span>
                  {r.draft.merchant && r.draft.merchant !== r.draft.description && <span className="block text-xs text-muted">{r.draft.description}</span>}
                  {r.duplicate && <Chip size="sm" color="warning">¿duplicado?</Chip>}
                </td>
                <td className="px-2 py-1.5">
                  {r.draft.kind === "transfer" ? (
                    <span className="text-muted">Traspaso</span>
                  ) : (
                    <select aria-label="Categoría" className="field min-h-9 py-1 text-sm" value={r.categoryId ?? ""} onChange={(e) => set(i, { categoryId: e.target.value || null })}>
                      <option value="">Sin categoría</option>
                      {cats.filter((c) => c.kind === r.draft.kind).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                  )}
                </td>
                <td className={cn("whitespace-nowrap px-2 py-1.5 text-right font-extrabold tabular-nums", r.draft.kind === "income" && "text-success")}>
                  <button type="button" title="Cambiar signo" onClick={() => set(i, { draft: { ...r.draft, kind: r.draft.kind === "expense" ? "income" : "expense" } })}>
                    {r.draft.kind === "expense" ? "−" : r.draft.kind === "income" ? "+" : "↔"}
                    {money(r.draft.amount)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onDone}>Descartar</Button>
        <Button onPress={commit} isDisabled={selected.length === 0}>Guardar {selected.length} movimientos</Button>
      </div>
    </Card>
  );
}

function HoldingsReview({ items, onDone }: { items: AiHolding[]; onDone: () => void }) {
  const [include, setInclude] = useState<boolean[]>(items.map(() => true));
  const [total, setTotal] = useState<string>("");
  const needsTotal = items.some((h) => h.weightPct != null && h.value == null && h.units == null);
  const save = () => {
    const currency = settings.get().currency;
    const t = Number(total.replace(/\./g, "").replace(",", ".")) || 0;
    items.forEach((h, i) => {
      if (!include[i]) return;
      const byUnits = h.units != null && h.units > 0;
      const value = h.value ?? (h.weightPct != null && t ? (t * h.weightPct) / 100 : 0);
      holdings.create({
        name: h.name,
        symbol: h.symbol,
        isin: h.isin,
        assetType: h.assetType,
        valuationMode: byUnits ? "units" : "value",
        units: h.units ?? 0,
        avgCost: h.avgCost ?? (byUnits && h.invested ? h.invested / h.units! : 0),
        invested: h.invested ?? value,
        manualValue: byUnits ? null : value,
        currency: (h.currency && /^[A-Z]{3}$/.test(h.currency) ? h.currency : currency) as typeof currency,
        targetWeight: h.weightPct ?? null,
      });
    });
    toast.success("Cartera importada");
    void refreshQuotes({ force: true });
    void refreshAllFeeds();
    onDone();
  };
  return (
    <Card className="gap-3">
      <SectionTitle>Posiciones detectadas</SectionTitle>
      <ul className="flex flex-col gap-2">
        {items.map((h, i) => (
          <li key={`${h.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border p-2.5 text-sm">
            <CheckboxField label={`Incluir ${h.name}`} hideLabel isSelected={include[i]} onChange={(v) => setInclude(include.map((x, j) => (j === i ? v : x)))} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{h.name}</span>
              <span className="block text-xs text-muted">{[h.symbol, h.isin, ASSET_TYPE_LABEL[h.assetType]].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="text-right text-xs">
              {h.units != null && <span className="block">{h.units} u.{h.avgCost != null && ` × ${h.avgCost}`}</span>}
              {h.value != null && <span className="block font-bold">{h.value.toLocaleString("es-ES")} {h.currency ?? ""}</span>}
              {h.weightPct != null && <span className="block">{h.weightPct} %</span>}
            </span>
          </li>
        ))}
      </ul>
      {needsTotal && (
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Valor total de la cartera (para convertir los porcentajes)
          <input className="field max-w-xs" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="25.000" />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onDone}>Descartar</Button>
        <Button onPress={save}>Añadir a mi cartera</Button>
      </div>
    </Card>
  );
}

export function ImportScreen() {
  const accs = useAccounts();
  const [mode, setMode] = useState<Mode>("movements");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<PreparedRow[] | null>(null);
  const [closing, setClosing] = useState<number | null>(null);
  const [source, setSource] = useState<"ai" | "csv">("ai");
  const [holdingsFound, setHoldingsFound] = useState<AiHolding[] | null>(null);
  const [defaultAccount, setDefaultAccount] = useState<string | null>(null);
  const account = defaultAccount ?? accs.find((a) => a.type === "checking")?.id ?? null;

  const reset = () => {
    setRows(null);
    setHoldingsFound(null);
    setText("");
    setClosing(null);
  };

  const runAi = async (input: string) => {
    if (mode === "portfolio") {
      setBusy("La IA está leyendo tu cartera…");
      try {
        const found = await aiExtractHoldings(input);
        if (found.length === 0) toast.warning("No hemos encontrado posiciones en ese texto");
        else setHoldingsFound(found);
      } catch {
        toast.danger("La IA no ha respondido", { description: "Revisa Ajustes → Inteligencia artificial." });
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy("La IA está leyendo los movimientos…");
    try {
      const r = await aiExtractTransactions(input, (done, total) => total > 1 && setBusy(`La IA está leyendo los movimientos… (${Math.min(done + 1, total)}/${total})`));
      if (r.drafts.length === 0) toast.warning("No hemos encontrado movimientos en ese texto");
      else {
        setRows(prepareImport(r.drafts, account));
        setClosing(r.closingBalance);
        setSource("ai");
      }
    } catch {
      toast.danger("La IA no ha respondido", { description: "Prueba de nuevo o revisa tus proveedores en Ajustes." });
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("Leyendo el archivo…");
    try {
      const { text: content, kind } = await readFile(file);
      if (mode === "movements" && kind === "csv") {
        const parsed = parseCsv(content);
        const mapping = detectMapping(parsed);
        const drafts = mapping ? rowsToDrafts(parsed, mapping) : [];
        if (drafts.length > 0) {
          setRows(prepareImport(drafts, account));
          setClosing(mapping ? closingBalance(parsed, mapping) : null);
          setSource("csv");
          toast.success(`${drafts.length} movimientos leídos del CSV`, { description: "Sin IA: columnas detectadas automáticamente." });
          setBusy(null);
          return;
        }
      }
      if (!content.trim()) {
        toast.warning("El archivo no tiene texto (¿PDF escaneado?)", { description: "Copia el texto a mano o exporta el extracto en CSV." });
        setBusy(null);
        return;
      }
      setText(content.slice(0, 60000));
      await runAi(content);
    } catch {
      toast.danger("No se pudo leer el archivo");
      setBusy(null);
    }
  };

  const hint = useMemo(
    () =>
      mode === "movements"
        ? "03/10/2026  COMPRA MERCADONA VALENCIA  -45,30\n01/10/2026  ABONO NÓMINA ACME SL  +1.850,00\n…o simplemente: «ayer 12 € en el cine y el lunes 60 € de gasolina»"
        : "Vanguard Global Stock Index 8.200 € (65 %)\niShares Emerging Markets 1.300 € (10 %)\n0,05 BTC comprados a 52.000 €\n…o pega el informe de tu bróker",
    [mode],
  );

  return (
    <>
      <PageHeader title="Importar con IA" description="Sin conectar el banco: sube el extracto (CSV o PDF), pega el texto o descríbelo con tus palabras. Revisas todo antes de guardar." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          {!rows && !holdingsFound && (
            <Card className="gap-4">
              <Segmented label="Qué quieres importar" value={mode} onChange={(m) => { setMode(m); reset(); }} options={[{ id: "movements", label: "Movimientos del banco" }, { id: "portfolio", label: "Cartera de inversión" }]} className="self-start" />
              {mode === "movements" && <SelectInput className="max-w-sm" label="Cuenta por defecto" value={account} onChange={setDefaultAccount} emptyLabel="Sin cuenta" options={accs.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} />}
              <label className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center transition-colors hover:bg-surface-secondary", busy && "pointer-events-none opacity-60")}>
                <Upload size={28} className="text-accent" aria-hidden="true" />
                <span className="font-extrabold">Sube un archivo</span>
                <span className="text-sm text-muted">{mode === "movements" ? "CSV o Excel exportado como CSV (se lee sin IA), PDF del extracto o TXT" : "PDF o TXT del informe de tu bróker o robo-advisor"}</span>
                <input type="file" className="sr-only" accept=".csv,.tsv,.txt,.pdf,text/csv,application/pdf,text/plain" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <TextAreaInput label="…o pega el texto aquí" value={text} onChange={setText} rows={8} placeholder={hint} />
              <div className="flex flex-wrap items-center gap-3">
                <Button onPress={() => void runAi(text)} isDisabled={!text.trim() || Boolean(busy)}>
                  <Sparkles size={16} aria-hidden="true" /> Analizar con IA
                </Button>
                {busy && <span className="flex items-center gap-2 text-sm font-semibold text-muted"><Spinner size="sm" /> {busy}</span>}
              </div>
            </Card>
          )}
          {rows && <Review rows={rows} setRows={setRows} closing={closing} source={source} onDone={reset} />}
          {holdingsFound && <HoldingsReview items={holdingsFound} onDone={reset} />}
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle>Cómo funciona</SectionTitle>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex gap-3"><FileSpreadsheet size={20} className="shrink-0 text-accent" aria-hidden="true" /><span><strong>CSV:</strong> detectamos fecha, concepto e importe (también columnas cargo/abono) sin usar IA. Exporta desde la web de tu banco.</span></li>
              <li className="flex gap-3"><FileText size={20} className="shrink-0 text-accent" aria-hidden="true" /><span><strong>PDF o texto:</strong> la IA extrae cada movimiento, limpia el nombre del comercio y propone categoría. Si el extracto muestra el saldo final, puedes cuadrar la cuenta.</span></li>
              <li className="flex gap-3"><LineChart size={20} className="shrink-0 text-accent" aria-hidden="true" /><span><strong>Cartera:</strong> pega el informe del bróker o escribe «70 % MSCI World, 20 % emergentes, 10 % bitcoin».</span></li>
              <li className="flex gap-3"><Sparkles size={20} className="shrink-0 text-accent" aria-hidden="true" /><span>Detectamos duplicados y aprendemos tus categorías: si recategorizas un comercio, la próxima vez se clasifica solo.</span></li>
            </ul>
          </Card>
          <Card>
            <SectionTitle>Privacidad</SectionTitle>
            <p className="text-sm text-muted">El texto se envía al proveedor de IA que tengas configurado (OpenRouter, Gemini o tu propio servidor) solo para extraer los movimientos. Puedes borrar tu nombre, DNI o IBAN antes de pegarlo: no hacen falta. Los CSV se procesan en tu navegador.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
