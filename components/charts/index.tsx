"use client";

import { useId, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";

// Shared chart chrome: recessive grid/axes, one y-axis, crosshair tooltips, legends for >= 2 series.
// Colours come from the validated --series-N tokens (light/dark stepped in globals.css).

type Fmt = (n: number) => string;

const axis = { stroke: "var(--chart-axis)", tickLine: false, axisLine: false, tick: { fill: "var(--chart-muted)", fontSize: 12 } } as const;

function TooltipBox({ title, rows }: { title?: ReactNode; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-40 rounded-2xl border border-border bg-overlay/85 px-3.5 py-2.5 text-sm shadow-lift backdrop-blur-md">
      {title && <p className="mb-1 text-xs font-medium text-muted">{title}</p>}
      <ul className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color, opacity: r.dashed ? 0.6 : 1 }} />}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block h-2.5 w-4 rounded-sm", i.dashed && "h-0.5 border-t border-dashed bg-transparent")} style={i.dashed ? { borderColor: i.color } : { background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  area?: boolean;
}

// Time series with one or more lines/areas sharing one axis. Areas get the "balance" treatment:
// a soft gradient fill under a glowing line, dashed crosshair and a glass tooltip.
export function TimeChart({ data, xKey, series, format, height = 240, xFormat, ariaLabel, reference, compactAxis }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; format: Fmt; height?: number; xFormat?: (v: string) => string; ariaLabel: string; reference?: { y: number; label: string }; compactAxis?: Fmt }) {
  const uid = useId().replace(/:/g, "");
  const gid = (kind: string, key: string) => `${kind}-${uid}-${key}`;
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      {series.length > 1 && <Legend className="mb-2" items={series} />}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.filter((s) => s.area).map((s) => (
              <linearGradient key={s.key} id={gid("grad", s.key)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey={xKey} {...axis} tickFormatter={xFormat} minTickGap={24} />
          <YAxis {...axis} width={76} tickFormatter={compactAxis ?? format} domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.7 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={xFormat ? xFormat(String(label)) : String(label)}
                  rows={series.map((s) => {
                    const raw = (payload[0].payload as Record<string, unknown>)[s.key];
                    return { label: s.label, color: s.color, dashed: s.dashed, value: raw == null ? "—" : format(Number(raw)) };
                  })}
                />
              ) : null
            }
          />
          {reference && <ReferenceLine y={reference.y} ifOverflow="extendDomain" stroke="var(--chart-muted)" strokeDasharray="4 4" label={{ value: reference.label, position: "insideTopLeft", fill: "var(--chart-muted)", fontSize: 12 }} />}
          {series.filter((s) => s.area).map((s) => (
            <Line key={`glow-${s.key}`} className="chart-glow" type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={4} dot={false} activeDot={false} tooltipType="none" isAnimationActive={false} legendType="none" />
          ))}
          {series.map((s) =>
            s.area ? (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.75} fill={`url(#${gid("grad", s.key)})`} dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: s.color, fill: "var(--surface)", className: "chart-dot" }} isAnimationActive={false} />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Grouped bars (e.g. income vs spending per month).
export function GroupedBars({ data, xKey, series, format, height = 240, xFormat, ariaLabel, compactAxis }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; format: Fmt; height?: number; xFormat?: (v: string) => string; ariaLabel: string; compactAxis?: Fmt }) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <Legend className="mb-2" items={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey={xKey} {...axis} tickFormatter={xFormat} />
          <YAxis {...axis} width={76} tickFormatter={compactAxis ?? format} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? <TooltipBox title={xFormat ? xFormat(String(label)) : String(label)} rows={series.map((s) => ({ label: s.label, color: s.color, value: format(Number((payload[0].payload as Record<string, unknown>)[s.key] ?? 0)) }))} /> : null
            }
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Allocation donut with a legend table (values + shares) beside it.
export function Donut({ items, format, ariaLabel, center }: { items: { key: string; label: string; value: number; color: string }[]; format: Fmt; ariaLabel: string; center?: ReactNode }) {
  const total = items.reduce((n, i) => n + Math.max(0, i.value), 0);
  return (
    <div className="@container w-full">
    <div className="flex flex-col items-center gap-4 @md:flex-row @md:items-center">
      <div role="img" aria-label={ariaLabel} className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items.filter((i) => i.value > 0)} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {items.filter((i) => i.value > 0).map((i) => (
                <Cell key={i.key} fill={i.color} />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipBox rows={[{ label: String(payload[0].name), value: `${format(Number(payload[0].value))} · ${total ? ((Number(payload[0].value) / total) * 100).toFixed(1) : 0} %`, color: (payload[0].payload as { color: string }).color }]} /> : null)} />
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm" style={{ background: i.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{i.label}</span>
            <span className="whitespace-nowrap tabular-nums text-muted">{total ? ((Math.max(0, i.value) / total) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : "0"} %</span>
            <span className="w-24 whitespace-nowrap text-right font-bold tabular-nums">{format(i.value)}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

// Monte Carlo fan: p10-p90 band, median line, target reference.
export function FanChart({ data, format, target, targetLabel, height = 260, ariaLabel, compactAxis }: { data: { x: string; low: number; band: number; mid: number }[]; format: Fmt; target: number; targetLabel: string; height?: number; ariaLabel: string; compactAxis?: Fmt }) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <Legend className="mb-2" items={[{ label: "Rango probable (p10–p90)", color: "color-mix(in srgb, var(--series-1) 30%, transparent)" }, { label: "Mediana", color: "var(--series-1)" }, { label: targetLabel, color: "var(--chart-muted)", dashed: true }]} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="x" {...axis} minTickGap={24} />
          <YAxis {...axis} width={76} tickFormatter={compactAxis ?? format} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { low: number; band: number; mid: number };
              return <TooltipBox title={String(label)} rows={[{ label: "Pesimista (p10)", value: format(p.low) }, { label: "Mediana", value: format(p.mid), color: "var(--series-1)" }, { label: "Optimista (p90)", value: format(p.low + p.band) }]} />;
            }}
          />
          <Area type="monotone" dataKey="low" stackId="fan" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area type="monotone" dataKey="band" stackId="fan" stroke="none" fill="var(--series-1)" fillOpacity={0.22} isAnimationActive={false} />
          <Line type="monotone" dataKey="mid" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <ReferenceLine y={target} stroke="var(--chart-muted)" strokeDasharray="5 4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Stat card with a small area chart tucked into the bottom-right corner (reference "Gross Revenue").
export function TrendCard({ title, description, value, delta, deltaLabel, values, color, href, className }: { title: string; description?: string; value: ReactNode; delta?: ReactNode; deltaLabel?: string; values: number[]; color: string; href?: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const data = values.map((v, i) => ({ i, v }));
  const Tag = href ? "a" : "div";
  return (
    <Tag
      href={href}
      className={cn("card relative block min-h-[9.5rem] overflow-hidden transition-colors", href && "hover:bg-surface-secondary", className)}
      style={{ borderColor: `color-mix(in srgb, ${color} 38%, var(--border))`, boxShadow: `0 0 28px -18px ${color}` }}
    >
      <p className="text-lg font-medium leading-tight">{title}</p>
      {description && <p className="text-sm text-muted">{description}</p>}
      <p className="relative z-10 mt-auto pt-4 text-3xl font-normal tracking-tight tabular-nums">{value}</p>
      {(delta || deltaLabel) && (
        <p className="relative z-10 text-sm">
          <span style={{ color }}>{delta}</span> <span className="text-muted">{deltaLabel}</span>
        </p>
      )}
      {data.length > 1 && (
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[62%] w-[46%]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`tc-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#tc-${uid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Tag>
  );
}

// Tiny inline trend for lists (no axes, no tooltip: the number beside it carries the value).
export function Sparkline({ values, className, positive, color: forced }: { values: number[]; className?: string; positive?: boolean; color?: string }) {
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  const color = forced ?? (positive == null ? "var(--chart-muted)" : positive ? "var(--success)" : "var(--danger)");
  return (
    <div className={cn("h-8 w-24", className)} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line className="chart-glow" type="monotone" dataKey="v" stroke={color} strokeWidth={3} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
