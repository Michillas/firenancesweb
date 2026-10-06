"use client";

import { ExternalLink, LineChart, Newspaper, Percent, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Donut, Sparkline } from "@/components/charts";
import { Button, Card, Chip, Delta, Disclaimer, EmptyState, MoneyInput, PageHeader, SectionTitle, Spinner, Stat, toast } from "@/components/ui";
import { addDays } from "@/core/logic/dates";
import { allocationBy, byAssetType, rebalance } from "@/core/logic/portfolio";
import { cn } from "@/lib/cn";
import { ASSET_TYPE_SLOT, series } from "@/lib/colors";
import { formatDay, formatPct, formatRelative } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { canSearchWeb, portfolioBriefAction } from "@/store/actions/ai";
import { useCollection } from "@/store/create-collection-store";
import { refreshAllFeeds, refreshAllHistory, refreshQuotes, useMarketStatus } from "@/store/market";
import { useAgenda, useMoney, usePositions } from "@/store/selectors";
import { analyses, feeds } from "@/store/stores";
import { AgendaList } from "../shared/agenda-list";
import { HoldingModal } from "./holding-modal";
import { ASSET_TYPE_LABEL } from "./labels";
import { LiveBadge, LiveValue } from "./live";
import { WeightsModal } from "./weights-modal";

export function InvestmentsScreen() {
  const today = useToday();
  const money = useMoney();
  const { rows, totals } = usePositions();
  const status = useMarketStatus((s) => s);
  const feedRows = useCollection(feeds);
  const briefs = useCollection(analyses);
  const brief = briefs.find((b) => b.id === "an_portfolio");
  const [adding, setAdding] = useState(false);
  const [weights, setWeights] = useState(false);
  const [contribution, setContribution] = useState<number | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const agenda = useAgenda(addDays(today, -3), addDays(today, 90)).filter((a) => a.kind === "market");

  // One-year closes for the sparklines (cached 12 h per quote).
  useEffect(() => {
    void refreshAllHistory();
  }, []);

  const plan = useMemo(() => rebalance(rows, contribution ?? totals.monthlyContribution), [rows, contribution, totals.monthlyContribution]);
  const byType = byAssetType(rows);
  const byRegion = allocationBy(rows, (r) => r.holding.region);
  const news = useMemo(() => {
    const names = new Map(rows.map((r) => [r.holding.id, r.holding.name]));
    return feedRows
      .filter((f) => names.has(f.holdingId))
      .flatMap((f) => f.news.slice(0, 6).map((n) => ({ ...n, holding: names.get(f.holdingId)!, holdingId: f.holdingId })))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .filter((n, i, all) => all.findIndex((m) => m.url === n.url) === i)
      .slice(0, 14);
  }, [feedRows, rows]);

  const runBrief = async () => {
    setBriefing(true);
    try {
      await portfolioBriefAction();
    } catch {
      toast.danger("La IA no ha respondido", { description: "Revisa Ajustes → Inteligencia artificial." });
    } finally {
      setBriefing(false);
    }
  };

  const loadNews = async () => {
    setLoadingNews(true);
    await refreshAllFeeds(true);
    setLoadingNews(false);
  };

  return (
    <>
      <PageHeader
        title="Inversiones"
        description="Tu cartera de fondos indexados, ETFs, acciones y cripto: precios, peso, rentabilidad, noticias, eventos y análisis con IA."
        actions={
          <>
            <Button variant="secondary" onPress={() => void refreshQuotes({ force: true }).then((r) => r.failed.length && toast.warning(`Sin precio para: ${r.failed.join(", ")}`, { description: "Se valoran a precio de compra hasta que haya cotización." }))} isPending={status.refreshing}>
              {!status.refreshing && <RefreshCw size={16} aria-hidden="true" />} Precios
            </Button>
            <Button variant="secondary" onPress={() => setWeights(true)}>
              <Percent size={16} aria-hidden="true" /> Por porcentajes
            </Button>
            <Button onPress={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" /> Añadir
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Tu cartera está vacía"
          description="Añade tus posiciones una a una (buscando por nombre o ticker), escribe directamente los porcentajes de tu cartera o importa el informe de tu bróker con IA."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onPress={() => setAdding(true)}>Añadir inversión</Button>
              <Button variant="secondary" onPress={() => setWeights(true)}>Escribir porcentajes</Button>
              <Link href="/import" className="btn btn-secondary">Importar con IA</Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-3">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat label="Valor de mercado" value={money(totals.value)} />
              <Stat label="Aportado" value={money(totals.cost)} />
              <Stat label="Rentabilidad" value={<Delta value={totals.pnl} money={(n) => money(n, { sign: true })} />} hint={formatPct(totals.pnlPct, { sign: true })} />
              <Stat label="Hoy" value={<Delta value={totals.dayChange} money={(n) => money(n, { sign: true })} />} hint={formatPct(totals.dayChangePct, { sign: true })} />
              <Stat label="Aportación mensual" value={money(totals.monthlyContribution)} />
            </div>
            {(status.lastRun || status.lastError) && <p className="text-xs text-muted">{status.lastRun ? `Precios actualizados ${formatRelative(new Date(status.lastRun).toISOString())}. ` : ""}{status.lastError}</p>}
          </Card>

          <Card className="xl:col-span-3">
            <SectionTitle action={<LiveBadge />}>Posiciones</SectionTitle>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">Posiciones de la cartera</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-2 py-2">Activo</th>
                    <th className="px-2 py-2 text-right">Precio</th>
                    <th className="px-2 py-2 text-right">Hoy</th>
                    <th className="px-2 py-2">1 año</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-right">Peso</th>
                    <th className="px-2 py-2 text-right">Rentab.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const hist = r.quote?.history ?? [];
                    return (
                      <tr key={r.holding.id} className="border-t border-border">
                        <td className="px-2 py-2.5">
                          <Link href={`/investments/${r.holding.id}`} className="block font-bold hover:text-accent">{r.holding.name}</Link>
                          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <span>{r.holding.symbol || r.holding.isin || "—"}</span>
                            <span>· {ASSET_TYPE_LABEL[r.holding.assetType]}</span>
                            {r.priced === "cost" && <Chip size="sm" color="warning">sin cotización</Chip>}
                            {r.priced === "manual" && <Chip size="sm">manual</Chip>}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          <LiveValue quote={r.quote}>{r.price != null ? money(r.price, { currency: r.holding.currency }) : "—"}</LiveValue>
                        </td>
                        <td className="px-2 py-2.5 text-right">{r.quote ? <Delta pct={r.quote.changePct} /> : "—"}</td>
                        <td className="px-2 py-2.5">{hist.length > 1 ? <Sparkline values={hist.map((h) => h[1])} positive={hist[hist.length - 1][1] >= hist[0][1]} /> : <span className="text-xs text-muted">—</span>}</td>
                        <td className="px-2 py-2.5 text-right font-extrabold tabular-nums">
                          <LiveValue quote={r.quote}>{money(r.valueBase)}</LiveValue>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {formatPct(r.weight)}
                          {r.holding.targetWeight != null && <span className="block text-xs text-muted">obj. {r.holding.targetWeight} %</span>}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <Delta pct={r.pnlPct} />
                          <span className="block text-xs text-muted tabular-nums">{money(r.pnl, { sign: true })}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle>Distribución por tipo</SectionTitle>
            <Donut ariaLabel="Distribución por tipo de activo" items={byType.map((a) => ({ key: a.key, label: ASSET_TYPE_LABEL[a.key as keyof typeof ASSET_TYPE_LABEL] ?? a.key, value: a.value, color: series(ASSET_TYPE_SLOT[a.key] ?? 8) }))} format={(n) => money(n)} />
            {byRegion.length > 1 && (
              <div className="border-t border-border pt-3">
                <h3 className="mb-2 text-sm font-extrabold">Por región</h3>
                <ul className="flex flex-col gap-1.5">
                  {byRegion.map((r) => (
                    <li key={r.key} className="flex flex-col gap-0.5 text-sm">
                      <span className="flex justify-between"><span className="font-semibold">{r.key}</span><span className="tabular-nums text-muted">{formatPct(r.weight)}</span></span>
                      <span className="block h-2 overflow-hidden rounded-full bg-surface-tertiary"><span className="block h-full rounded-full" style={{ width: `${r.weight}%`, background: "var(--chart-hero)" }} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Rebalanceo con tu aportación</SectionTitle>
            {plan.length === 0 ? (
              <p className="text-sm text-muted">Indica un «peso objetivo» en tus posiciones para saber dónde meter cada aportación sin vender nada.</p>
            ) : (
              <>
                <MoneyInput label="Dinero a invertir" value={contribution ?? totals.monthlyContribution} onChange={setContribution} />
                <ul className="flex flex-col gap-2 text-sm">
                  {plan.map((p) => (
                    <li key={p.holding.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-secondary p-2">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{p.holding.name}</span>
                        <span className={cn("block text-xs", Math.abs(p.drift) >= 5 ? "font-bold text-warning" : "text-muted")}>
                          {formatPct(p.currentWeight)} → objetivo {formatPct(p.targetWeight)} ({p.drift > 0 ? "+" : ""}{p.drift.toFixed(1)} pp)
                        </span>
                      </span>
                      <span className={cn("shrink-0 font-extrabold tabular-nums", p.buy > 0 ? "text-success" : "text-muted")}>{p.buy > 0 ? `+${money(p.buy)}` : "—"}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>Próximos eventos</SectionTitle>
            <AgendaList items={agenda.slice(0, 8)} empty="Pulsa «Noticias» para cargar resultados y dividendos de tus acciones y ETFs." compact />
          </Card>

          <Card>
            <SectionTitle
              action={
                <Button size="sm" variant="secondary" onPress={runBrief} isPending={briefing}>
                  {!briefing && <Sparkles size={15} aria-hidden="true" />} {brief ? "Actualizar" : "Generar"}
                </Button>
              }
            >
              Resumen de la cartera con IA
            </SectionTitle>
            {briefing && <p className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> {canSearchWeb() ? "Buscando noticias en internet y analizando…" : "Analizando…"}</p>}
            {!brief && !briefing && <p className="text-sm text-muted">Qué ha pasado con tu cartera, riesgos de concentración y qué vigilar. {canSearchWeb() ? "Con búsqueda web (Gemini)." : "Añade una clave de Gemini para que busque noticias en internet."}</p>}
            {brief && (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-xs text-muted">Generado {formatRelative(brief.updatedAt)}{brief.grounded ? " · con búsqueda web" : ""}</p>
                {brief.summary.split("\n\n").map((para) => <p key={para.slice(0, 30)}>{para}</p>)}
                {brief.pastDrivers.length > 0 && <ul className="list-disc space-y-1 pl-5">{brief.pastDrivers.map((d) => <li key={d.title}>{d.title}</li>)}</ul>}
                {brief.risks.length > 0 && (<><h3 className="font-extrabold">Riesgos</h3><ul className="list-disc space-y-1 pl-5">{brief.risks.map((r) => <li key={r}>{r}</li>)}</ul></>)}
                {brief.upcoming.length > 0 && (<><h3 className="font-extrabold">A vigilar</h3><ul className="space-y-1">{brief.upcoming.map((u) => <li key={u.title}><span className="font-semibold">{u.date ? `${formatDay(u.date)} · ` : ""}</span>{u.title}</li>)}</ul></>)}
                {brief.sources.length > 0 && (
                  <details><summary className="cursor-pointer font-bold text-muted">Fuentes ({brief.sources.length})</summary><ul className="mt-1 space-y-1">{brief.sources.map((s) => <li key={s.url}><a className="text-accent underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a></li>)}</ul></details>
                )}
                <Disclaimer />
              </div>
            )}
          </Card>

          <Card className="xl:col-span-2">
            <SectionTitle action={<Button size="sm" variant="secondary" onPress={loadNews} isPending={loadingNews}>{!loadingNews && <Newspaper size={15} aria-hidden="true" />} Noticias</Button>}>Últimas noticias de tu cartera</SectionTitle>
            {news.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Pulsa «Noticias» para buscar titulares recientes de cada posición (Google News, Yahoo) y su calendario.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {news.map((n) => (
                  <li key={`${n.holdingId}-${n.url}`}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex h-full flex-col gap-1 rounded-xl border border-border p-3 hover:bg-surface-secondary">
                      <span className="font-bold leading-snug">{n.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">{n.holding} · {n.source}{n.publishedAt && ` · ${formatRelative(n.publishedAt)}`} <ExternalLink size={11} aria-hidden="true" /></span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      {adding && <HoldingModal holding={null} onClose={() => setAdding(false)} />}
      {weights && <WeightsModal onClose={() => setWeights(false)} />}
    </>
  );
}
