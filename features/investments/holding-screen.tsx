"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, ExternalLink, Heart, Minus, Pencil, RefreshCw, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TimeChart } from "@/components/charts";
import { Button, Card, Chip, Delta, Disclaimer, EmptyState, PageHeader, SectionTitle, Segmented, Spinner, Stat, toast } from "@/components/ui";
import type { Analysis } from "@/core/domain/market";
import { holdingQuoteKey } from "@/core/logic/networth";
import type { HistoryPoint } from "@/core/market/types";
import { cn } from "@/lib/cn";
import { formatDay, formatPct, formatRelative } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { analyzeHoldingAction, canSearchWeb, lookupPriceAction } from "@/store/actions/ai";
import { useItem } from "@/store/create-collection-store";
import { refreshFeed, refreshHistory } from "@/store/market";
import { useMoney, usePositions } from "@/store/selectors";
import { analyses, feeds, holdings } from "@/store/stores";
import { HoldingModal } from "./holding-modal";
import { LiveBadge, LiveValue } from "./live";
import { ASSET_TYPE_LABEL, SOURCE_LABEL } from "./labels";

type Range = "1mo" | "6mo" | "1y" | "5y";
const SENTIMENT: Record<Analysis["sentiment"], { label: string; color: "success" | "danger" | "default" | "warning" }> = { bullish: { label: "Alcista", color: "success" }, bearish: { label: "Bajista", color: "danger" }, neutral: { label: "Neutral", color: "default" }, mixed: { label: "Mixto", color: "warning" } };

function ImpactIcon({ impact }: { impact: "positive" | "negative" | "neutral" }) {
  const Icon = impact === "positive" ? ArrowUpRight : impact === "negative" ? ArrowDownRight : Minus;
  return <Icon size={16} aria-label={impact === "positive" ? "Impacto positivo" : impact === "negative" ? "Impacto negativo" : "Impacto neutro"} className={cn("mt-0.5 shrink-0", impact === "positive" ? "text-success" : impact === "negative" ? "text-danger" : "text-muted")} />;
}

export function HoldingScreen({ id }: { id: string }) {
  const router = useRouter();
  const today = useToday();
  const money = useMoney();
  const h = useItem(holdings, id);
  const feed = useItem(feeds, id);
  const analysis = useItem(analyses, `an_${id}`);
  const { rows } = usePositions();
  const pos = rows.find((r) => r.holding.id === id);
  const [range, setRange] = useState<Range>("1y");
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const priced = h ? holdingQuoteKey(h) !== null : false;

  useEffect(() => {
    if (!h || !priced) return;
    let cancelled = false;
    // Loading flags are set from the async callback, never synchronously in the effect body.
    void Promise.resolve()
      .then(() => !cancelled && setLoadingHistory(true))
      .then(() => refreshHistory(h, range))
      .then((points) => !cancelled && setHistory(points))
      .catch(() => !cancelled && setHistory([]))
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on holding identity / range only
  }, [h?.id, h?.symbol, h?.priceId, h?.priceSource, range, priced]);

  useEffect(() => {
    if (h) void refreshFeed(h).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per holding
  }, [h?.id]);

  // The latest (possibly live) price replaces or extends today's close so the chart moves in real time.
  const livePrice = pos?.quote ? pos.price : null;
  const points = (history ?? []).map(([date, close]) => ({ date, close }));
  const lastPoint = points[points.length - 1];
  const chart =
    livePrice == null || !lastPoint
      ? points
      : lastPoint.date === today
        ? [...points.slice(0, -1), { date: today, close: livePrice }]
        : lastPoint.date < today
          ? [...points, { date: today, close: livePrice }]
          : points;
  const first = chart[0]?.close;
  const last = chart[chart.length - 1]?.close;

  if (!h) {
    return <EmptyState icon={Search} title="No encontramos esta inversión" description="Puede que se haya eliminado." action={<Link href="/investments" className="btn btn-secondary">Volver a la cartera</Link>} />;
  }

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await analyzeHoldingAction(h);
    } catch {
      toast.danger("La IA no ha respondido", { description: "Revisa Ajustes → Inteligencia artificial." });
    } finally {
      setAnalyzing(false);
    }
  };

  const reloadFeed = async () => {
    setLoadingFeed(true);
    await refreshFeed(h, true).catch(() => undefined);
    setLoadingFeed(false);
  };

  const lookup = async () => {
    setLookingUp(true);
    try {
      const r = await lookupPriceAction(h);
      if (r.price == null) toast.warning("No hemos encontrado un valor fiable");
      else if (h.valuationMode === "units") {
        holdings.update(h.id, { manualPrice: r.price, priceSource: "manual" });
        toast.success(`Precio actualizado: ${r.price} ${r.currency ?? ""}`, { description: r.date ? `Fecha del dato: ${r.date}` : undefined });
      } else toast.info(`Valor liquidativo encontrado: ${r.price} ${r.currency ?? ""}`, { description: "Multiplícalo por tus participaciones o cambia a valoración por participaciones." });
    } catch {
      toast.danger("La búsqueda web necesita una clave de Gemini");
    } finally {
      setLookingUp(false);
    }
  };

  const upcoming = (feed?.events ?? []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = (feed?.events ?? []).filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <Link href="/investments" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Cartera
      </Link>
      <PageHeader
        flush={false}
        title={h.name}
        description={[h.symbol, h.isin, ASSET_TYPE_LABEL[h.assetType], h.region, h.sector].filter(Boolean).join(" · ")}
        actions={
          <>
            {canSearchWeb() && (h.valuationMode === "value" || !pos?.quote) && (
              <Button variant="secondary" onPress={lookup} isPending={lookingUp}>
                {!lookingUp && <Search size={16} aria-hidden="true" />} Buscar valor con IA
              </Button>
            )}
            <Button variant="secondary" onPress={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" /> Editar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Stat
              size="lg"
              label={pos?.quote ? `Precio · ${SOURCE_LABEL[(pos.quote.source as keyof typeof SOURCE_LABEL) ?? "auto"] ?? pos.quote.source}` : "Precio"}
              value={<LiveValue quote={pos?.quote}>{pos?.price != null ? money(pos.price, { currency: h.currency, decimals: pos.price < 1 ? 4 : 2 }) : "—"}</LiveValue>}
              delta={pos?.quote ? <Delta pct={pos.quote.changePct} /> : undefined}
              hint={pos?.quote ? `hoy · ${formatRelative(pos.quote.asOf)}` : h.valuationMode === "value" ? "valorado a mano" : "sin cotización: se usa el precio de compra"}
            />
            {priced && <LiveBadge className="self-center" />}
            {priced && <Segmented label="Periodo" size="sm" value={range} onChange={setRange} options={[{ id: "1mo", label: "1M" }, { id: "6mo", label: "6M" }, { id: "1y", label: "1A" }, { id: "5y", label: "5A" }]} />}
          </div>
          {priced ? (
            loadingHistory && !history ? (
              <div className="grid h-60 place-items-center"><Spinner /></div>
            ) : chart.length > 1 ? (
              <>
                <p className="text-sm text-muted">En el periodo: <Delta pct={first ? ((last - first) / first) * 100 : null} /></p>
                <TimeChart ariaLabel={`Precio de ${h.name}`} data={chart} xKey="date" xFormat={(d) => formatDay(d, range === "5y" ? "long" : "short")} series={[{ key: "close", label: "Cierre", color: "var(--chart-hero)", area: true }]} format={(n) => money(n, { currency: h.currency, decimals: n < 1 ? 4 : 2 })} compactAxis={(n) => money(n, { currency: h.currency, decimals: n < 1 ? 2 : n < 50 ? 1 : 0 })} reference={h.avgCost > 0 && h.valuationMode === "units" ? { y: h.avgCost, label: "Tu precio medio" } : undefined} height={260} />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted">No hay histórico disponible ahora mismo para este ticker.</p>
            )
          ) : (
            <p className="py-10 text-center text-sm text-muted">Esta posición se valora a mano. Añade el ticker (y participaciones) para ver el gráfico y actualizar el precio solo.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Tu posición</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Valor" value={money(pos?.valueBase ?? 0)} />
            <Stat label="Peso" value={formatPct(pos?.weight)} hint={h.targetWeight != null ? `objetivo ${h.targetWeight} %` : undefined} />
            <Stat label="Aportado" value={money(pos?.costBase ?? 0)} />
            <Stat label="Rentabilidad" value={<Delta value={pos?.pnl ?? 0} money={(n) => money(n, { sign: true })} />} hint={formatPct(pos?.pnlPct, { sign: true })} />
          </div>
          {h.valuationMode === "units" && (
            <p className="text-sm text-muted">
              {h.units.toLocaleString("es-ES", { maximumFractionDigits: 6 })} unidades a {money(h.avgCost, { currency: h.currency })} de media.
            </p>
          )}
          {h.monthlyContribution > 0 && <p className="text-sm text-muted">Aportas {money(h.monthlyContribution)} al mes.</p>}
          {h.notes && <p className="rounded-xl bg-surface-secondary p-2.5 text-sm">{h.notes}</p>}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle
            action={
              <Button size="sm" onPress={runAnalysis} isPending={analyzing}>
                {!analyzing && <Sparkles size={15} aria-hidden="true" />} {analysis ? "Actualizar análisis" : "Analizar con IA"}
              </Button>
            }
          >
            Qué le afecta y qué puede pasar
          </SectionTitle>
          {analyzing && <p className="flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> {canSearchWeb() ? "Buscando noticias, resultados y lo que se comenta en redes…" : "Analizando titulares y precios…"}</p>}
          {!analysis && !analyzing && (
            <p className="text-sm text-muted">
              La IA cruza las noticias recientes, publicaciones en redes, el calendario corporativo y la evolución del precio para explicar qué lo movió, qué viene y tres escenarios a 12 meses. {canSearchWeb() ? "Usará búsqueda en Google (Gemini)." : "Con una clave de Gemini además buscará en internet."}
            </p>
          )}
          {analysis && (
            <div className="flex flex-col gap-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Chip size="sm" color={SENTIMENT[analysis.sentiment].color}>{SENTIMENT[analysis.sentiment].label}</Chip>
                Generado {formatRelative(analysis.updatedAt)}{analysis.grounded ? " · con búsqueda web" : " · con titulares recopilados"}{analysis.provider && ` · ${analysis.provider}`}
              </p>
              <p className="text-[0.95rem] leading-relaxed">{analysis.summary}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section>
                  <h3 className="mb-2 font-extrabold">Lo que ya movió el precio</h3>
                  <ul className="flex flex-col gap-2">
                    {analysis.pastDrivers.map((d) => (
                      <li key={d.title} className="flex gap-2">
                        <ImpactIcon impact={d.impact} />
                        <span><span className="font-bold">{d.date ? `${formatDay(d.date)} · ` : ""}{d.title}</span>{d.detail && <span className="block text-muted">{d.detail}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-2 font-extrabold">Lo que puede moverlo</h3>
                  <ul className="flex flex-col gap-2">
                    {analysis.upcoming.map((d) => (
                      <li key={d.title} className="flex gap-2">
                        <ImpactIcon impact={d.impact} />
                        <span><span className="font-bold">{d.date ? `${formatDay(d.date)} · ` : ""}{d.title}</span>{d.detail && <span className="block text-muted">{d.detail}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              {analysis.scenarios.length > 0 && (
                <section>
                  <h3 className="mb-2 font-extrabold">Escenarios ({analysis.horizon})</h3>
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {analysis.scenarios.map((s) => (
                      <li key={s.label} className="rounded-xl border border-border p-3">
                        <p className="flex items-center justify-between font-extrabold">
                          <span>{s.label}</span>
                          <span className={cn("tabular-nums", (s.changePct ?? 0) > 0 ? "text-success" : (s.changePct ?? 0) < 0 ? "text-danger" : "")}>{s.changePct != null ? formatPct(s.changePct, { sign: true, decimals: 0 }) : ""}</span>
                        </p>
                        {s.probability != null && <p className="text-xs font-bold text-muted">Probabilidad estimada {s.probability} %</p>}
                        <p className="mt-1 text-muted">{s.thesis}</p>
                        {s.changePct != null && pos && <p className="mt-1 text-xs font-semibold">Tu posición: {money(pos.valueBase * (1 + s.changePct / 100))}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {analysis.risks.length > 0 && (
                <section>
                  <h3 className="mb-1 font-extrabold">Riesgos</h3>
                  <ul className="list-disc space-y-1 pl-5 text-muted">{analysis.risks.map((r) => <li key={r}>{r}</li>)}</ul>
                </section>
              )}
              {analysis.sources.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-bold text-muted">Fuentes ({analysis.sources.length})</summary>
                  <ul className="mt-1 space-y-1">{analysis.sources.map((s) => <li key={s.url}><a className="text-accent underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a></li>)}</ul>
                </details>
              )}
              <Disclaimer />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Calendario</SectionTitle>
          {upcoming.length === 0 && past.length === 0 && <p className="text-sm text-muted">{h.assetType === "stock" || h.assetType === "etf" ? "Sin eventos conocidos (resultados, dividendos)." : "Los fondos y criptos no tienen calendario corporativo."}</p>}
          {upcoming.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {upcoming.map((e) => (
                <li key={`${e.kind}-${e.date}`} className="flex justify-between gap-2 rounded-xl bg-surface-secondary p-2">
                  <span className="font-bold">{e.title}{e.estimated && <span className="font-medium text-muted"> (estimado)</span>}</span>
                  <span className="shrink-0">{formatDay(e.date, "long")}{e.amount != null && ` · ${e.amount}`}</span>
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-muted">Historial reciente</summary>
              <ul className="mt-1 space-y-1">{past.map((e) => <li key={`${e.kind}-${e.date}`}>{formatDay(e.date, "long")} · {e.title}{e.amount != null && ` · ${e.amount}`}</li>)}</ul>
            </details>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle action={<Button size="sm" variant="secondary" onPress={reloadFeed} isPending={loadingFeed}>{!loadingFeed && <RefreshCw size={15} aria-hidden="true" />} Actualizar</Button>}>Noticias</SectionTitle>
          {feed?.fetchedAt && <p className="text-xs text-muted">Actualizado {formatRelative(feed.fetchedAt)} · Google News y Yahoo Finance (últimos 30 días)</p>}
          {(feed?.news.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted">{loadingFeed ? "Buscando…" : "Sin titulares recientes. Ajusta «Buscar noticias como» en Editar si el nombre es ambiguo."}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {feed!.news.filter((n, i, all) => all.findIndex((m) => m.url === n.url) === i).slice(0, 20).map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-0.5 py-2.5 hover:text-accent">
                    <span className="font-bold leading-snug">{n.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">{n.source}{n.publishedAt && ` · ${formatRelative(n.publishedAt)}`} <ExternalLink size={11} aria-hidden="true" /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>En redes</SectionTitle>
          <p className="text-xs text-muted">Publicaciones públicas de Bluesky ({h.symbol ? `$${h.symbol.split(".")[0]}` : h.name}). X/Twitter no ofrece API gratuita: el análisis con Gemini sí resume lo que se comenta allí.</p>
          {(feed?.social.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Sin publicaciones recientes.</p>
          ) : (
            <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
              {feed!.social.filter((p, i, all) => !p.url || all.findIndex((q) => q.url === p.url) === i).slice(0, 15).map((p) => (
                <li key={p.url || p.text.slice(0, 40)} className="rounded-xl bg-surface-secondary p-2.5 text-sm">
                  <p className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-bold">{p.author} <span className="font-medium text-muted">@{p.handle}</span></span>
                    <span className="flex shrink-0 items-center gap-1 text-muted"><Heart size={11} aria-hidden="true" /> {p.likes}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words">{p.text.length > 320 ? `${p.text.slice(0, 320)}…` : p.text}</p>
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent">{p.publishedAt ? formatRelative(p.publishedAt) : "Ver"} <ExternalLink size={11} aria-hidden="true" /></a>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {editing && <HoldingModal holding={h} onClose={() => setEditing(false)} onDeleted={() => router.push("/investments")} />}
    </>
  );
}
