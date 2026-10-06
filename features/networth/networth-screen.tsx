"use client";

import { Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Donut, TimeChart } from "@/components/charts";
import { Button, Card, Delta, EmojiBadge, EmptyState, PageHeader, SectionTitle, Segmented, Stat } from "@/components/ui";
import type { Account, OtherAsset } from "@/core/domain/finance";
import { addDays } from "@/core/logic/dates";
import { toBase } from "@/core/logic/money";
import { cn } from "@/lib/cn";
import { series } from "@/lib/colors";
import { formatDay, formatRelative } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { useCollection } from "@/store/create-collection-store";
import { useAccounts, useFx, useMoney, useNetWorth, usePositions } from "@/store/selectors";
import { assets, snapshots } from "@/store/stores";
import { ACCOUNT_TYPE_LABEL, AccountModal } from "./account-modal";
import { ASSET_CATEGORY_LABEL, AssetModal } from "./asset-modal";

type Range = "3m" | "6m" | "1y" | "all";

export function NetworthScreen() {
  const today = useToday();
  const money = useMoney();
  const fx = useFx();
  const nw = useNetWorth();
  const { totals } = usePositions();
  const accs = useAccounts({ includeArchived: true });
  const others = useCollection(assets);
  const snaps = useCollection(snapshots);
  const [range, setRange] = useState<Range>("1y");
  const [editAccount, setEditAccount] = useState<(Account & { balance: number }) | "new" | null>(null);
  const [editAsset, setEditAsset] = useState<{ asset: OtherAsset | null; kind: OtherAsset["kind"] } | null>(null);

  const history = useMemo(() => {
    const from = range === "all" ? "0000" : addDays(today, range === "3m" ? -92 : range === "6m" ? -183 : -366);
    return [...snaps].filter((s) => s.date >= from).sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ date: s.date, total: s.total, invested: s.investments }));
  }, [snaps, range, today]);
  const first = history[0];

  const active = accs.filter((a) => !a.archived);
  const archived = accs.filter((a) => a.archived);
  const owned = others.filter((a) => a.kind === "asset");
  const debts = others.filter((a) => a.kind === "liability");

  const composition = [
    { key: "cash", label: "Liquidez", value: nw.cash, color: series(1) },
    { key: "inv", label: "Inversiones", value: nw.investments, color: series(3) },
    { key: "assets", label: "Otros bienes", value: nw.assets, color: series(7) },
  ];

  return (
    <>
      <PageHeader
        title="Patrimonio"
        description="Todo lo que tienes menos lo que debes. Las cuentas se actualizan con tus movimientos; ajusta el saldo cuando quieras cuadrarlo con el banco."
        actions={
          <>
            <Button variant="secondary" onPress={() => setEditAsset({ asset: null, kind: "asset" })}>
              <Plus size={16} aria-hidden="true" /> Bien o deuda
            </Button>
            <Button onPress={() => setEditAccount("new")}>
              <Plus size={16} aria-hidden="true" /> Cuenta
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Stat size="lg" label="Patrimonio neto" value={money(nw.total)} delta={first ? <Delta value={nw.total - first.total} pct={first.total ? ((nw.total - first.total) / Math.abs(first.total)) * 100 : null} money={(n) => money(n)} /> : undefined} hint={first ? `desde el ${formatDay(first.date, "long")}` : undefined} />
            <Segmented label="Periodo" size="sm" value={range} onChange={setRange} options={[{ id: "3m", label: "3M" }, { id: "6m", label: "6M" }, { id: "1y", label: "1A" }, { id: "all", label: "Todo" }]} />
          </div>
          {history.length > 1 ? (
            <TimeChart ariaLabel="Histórico del patrimonio" data={history} xKey="date" xFormat={(d) => formatDay(d)} series={[{ key: "total", label: "Patrimonio neto", color: series(1), area: true }, { key: "invested", label: "Inversiones", color: series(3) }]} format={(n) => money(n)} compactAxis={(n) => money(n, { compact: true })} height={260} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">El histórico se construye solo: guardamos una foto de tu patrimonio cada día que abres la app.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Composición</SectionTitle>
          <Donut ariaLabel="Composición del patrimonio" items={composition} format={(n) => money(n)} center={<span className="text-xs font-bold text-muted">activos<br /><span className="text-base font-black text-foreground">{money(nw.cash + nw.investments + nw.assets, { compact: true })}</span></span>} />
          <div className="flex items-center justify-between rounded-xl bg-surface-secondary px-3 py-2 text-sm">
            <span className="font-bold">Deudas</span>
            <span className="font-extrabold tabular-nums text-danger">−{money(nw.liabilities)}</span>
          </div>
          {totals.value > 0 && (
            <p className="text-sm text-muted">
              Plusvalía latente de la cartera: <Delta value={totals.pnl} pct={totals.pnlPct} money={(n) => money(n)} />
            </p>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle action={<Button size="sm" variant="secondary" onPress={() => setEditAccount("new")}><Plus size={15} aria-hidden="true" /> Cuenta</Button>}>Cuentas</SectionTitle>
          {active.length === 0 ? (
            <EmptyState icon={Landmark} title="Añade tu primera cuenta" description="Tu cuenta nómina, la de ahorro, el efectivo… Escribe el saldo de hoy y listo." action={<Button onPress={() => setEditAccount("new")}>Añadir cuenta</Button>} />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {active.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setEditAccount(a)} className="choice">
                    <EmojiBadge emoji={a.emoji} color={a.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{a.name}</span>
                      <span className="block truncate text-xs font-semibold text-muted">
                        {ACCOUNT_TYPE_LABEL[a.type]}
                        {a.institution && ` · ${a.institution}`}
                        {a.interestRate ? ` · ${a.interestRate} % TAE` : ""}
                        {!a.includeInNetWorth && " · fuera del patrimonio"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={cn("block font-black tabular-nums", a.balance < 0 && "text-danger")}>{money(a.balance, { currency: a.currency })}</span>
                      {a.currency !== fx?.base && <span className="block text-xs text-muted">≈ {money(toBase(a.balance, a.currency, fx))}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-muted">{archived.length} cuentas archivadas</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {archived.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="text-left font-semibold text-muted hover:text-foreground" onClick={() => setEditAccount(a)}>
                      {a.emoji} {a.name} · {money(a.balance, { currency: a.currency })}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <SectionTitle action={<Link className="text-sm font-bold text-accent" href="/investments">Ver cartera</Link>}>Inversiones</SectionTitle>
          <Stat label="Valor de mercado" value={money(totals.value)} hint={totals.cost ? `invertido ${money(totals.cost)}` : undefined} />
          {nw.investments - nw.holdings > 0.5 && <p className="text-sm text-muted">+ {money(nw.investments - nw.holdings)} en efectivo en cuentas de bróker/cripto.</p>}
        </Card>

        <Card className="xl:col-span-3">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              { title: "Bienes", list: owned, kind: "asset" as const, empty: "Vivienda, coche, objetos de valor…" },
              { title: "Deudas", list: debts, kind: "liability" as const, empty: "Hipoteca, préstamos, tarjetas…" },
            ].map((group) => (
              <section key={group.kind} className="flex flex-col gap-3">
                <SectionTitle action={<Button size="sm" variant="secondary" onPress={() => setEditAsset({ asset: null, kind: group.kind })}><Plus size={15} aria-hidden="true" /> Añadir</Button>}>{group.title}</SectionTitle>
                {group.list.length === 0 ? (
                  <p className="text-sm text-muted">{group.empty}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {group.list.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setEditAsset({ asset: a, kind: a.kind })} className="choice py-2.5">
                          <EmojiBadge emoji={a.emoji} size="sm" color={a.kind === "asset" ? "violet" : "rose"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{a.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {ASSET_CATEGORY_LABEL[a.category]}
                              {a.kind === "liability" && a.monthlyPayment ? ` · ${money(a.monthlyPayment)}/mes` : ""}
                              {a.kind === "liability" && a.interestRate ? ` · ${a.interestRate} %` : ""}
                              {a.endDate ? ` · hasta ${formatDay(a.endDate, "long")}` : ""}
                              {` · act. ${formatRelative(a.updatedAt)}`}
                            </span>
                          </span>
                          <span className={cn("font-black tabular-nums", a.kind === "liability" && "text-danger")}>{a.kind === "liability" ? "−" : ""}{money(a.value)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </Card>
      </div>

      {editAccount && <AccountModal key={editAccount === "new" ? "new" : editAccount.id} account={editAccount === "new" ? null : editAccount} balance={editAccount === "new" ? 0 : editAccount.balance} onClose={() => setEditAccount(null)} />}
      {editAsset && <AssetModal key={editAsset.asset?.id ?? `new-${editAsset.kind}`} asset={editAsset.asset} defaultKind={editAsset.kind} onClose={() => setEditAsset(null)} />}
    </>
  );
}
