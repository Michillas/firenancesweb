import type { Account, AccountType, Holding, OtherAsset, Transaction } from "../domain/finance";
import type { Quote } from "../domain/market";
import { convert, toBase, type FxTable } from "./money";

// Balance = opening balance + movements dated on/after the opening date.
export function accountBalance(account: Pick<Account, "id" | "openingBalance" | "openingDate">, txs: readonly Transaction[]): number {
  let balance = account.openingBalance;
  for (const tx of txs) {
    if (tx.date < account.openingDate) continue;
    if (tx.accountId === account.id) {
      if (tx.kind === "income") balance += tx.amount;
      else balance -= tx.amount; // expense and outgoing transfer
    } else if (tx.kind === "transfer" && tx.toAccountId === account.id) {
      balance += tx.amount;
    }
  }
  return balance;
}

export function balancesById(accounts: readonly Account[], txs: readonly Transaction[]): Map<string, number> {
  return new Map(accounts.map((a) => [a.id, accountBalance(a, txs)]));
}

// Opening balance that makes the derived balance equal `target` (the "set balance" action).
export function openingFor(account: Account, txs: readonly Transaction[], target: number): number {
  const current = accountBalance(account, txs);
  return account.openingBalance + (target - current);
}

export const quoteKey = (source: string, id: string) => `${source}:${id.trim().toUpperCase()}`;

// Price lookup key of a holding, or null when it is valued by hand.
type PriceFields = Pick<Holding, "priceSource" | "priceId" | "symbol" | "isin" | "assetType">;

export function holdingQuoteKey(h: PriceFields & Pick<Holding, "valuationMode">): string | null {
  if (h.valuationMode === "value" || h.priceSource === "manual") return null;
  const id = priceIdOf(h);
  if (!id) return null;
  return quoteKey(resolveSource(h), id);
}

const FUND_TYPES = new Set(["index_fund", "pension", "bond", "cash"]);

// "auto" picks CoinGecko for crypto, justETF / FT by ISIN for European ETFs and funds, Yahoo for
// exchange-suffixed tickers (VWCE.DE) and Nasdaq otherwise. The server adds fallbacks between them.
export function resolveSource(h: PriceFields): Exclude<Holding["priceSource"], "auto"> {
  if (h.priceSource !== "auto") return h.priceSource;
  if (h.assetType === "crypto") return "coingecko";
  const isin = h.isin.trim();
  if (isin && FUND_TYPES.has(h.assetType)) return "ft";
  if (isin && (h.assetType === "etf" || !h.symbol.trim())) return "justetf";
  const id = (h.priceId || h.symbol).trim();
  // FT symbols look like "6702:TYO" / "VSURE:STO".
  if (id.includes(":")) return "ftstock";
  if (/[.=^]/.test(id)) return "yahoo";
  return "nasdaq";
}

// Provider id: the ISIN for ISIN-based sources, otherwise priceId or ticker.
export function priceIdOf(h: PriceFields): string {
  const source = resolveSource(h);
  if (source === "justetf" || source === "ft") return h.isin.trim().toUpperCase();
  return (h.priceId || h.symbol).trim();
}

export interface HoldingValuation {
  // In the holding currency.
  price: number | null;
  value: number;
  cost: number;
  // In the base currency.
  valueBase: number;
  costBase: number;
  dayChangeBase: number;
  priced: "quote" | "manual" | "cost";
}

export function valueHolding(h: Holding, quote: Quote | undefined, fx: FxTable | null): HoldingValuation {
  if (h.valuationMode === "value") {
    const value = h.manualValue ?? h.invested;
    return { price: null, value, cost: h.invested, valueBase: toBase(value, h.currency, fx), costBase: toBase(h.invested, h.currency, fx), dayChangeBase: 0, priced: "manual" };
  }
  let price: number | null = null;
  let priced: HoldingValuation["priced"] = "cost";
  let dayChange = 0;
  if (h.manualPrice != null && (h.priceSource === "manual" || !quote)) {
    price = h.manualPrice;
    priced = "manual";
  } else if (quote) {
    price = convert(quote.price, quote.currency || h.currency, h.currency, fx);
    dayChange = convert(quote.change, quote.currency || h.currency, h.currency, fx) * h.units;
    priced = "quote";
  }
  const effective = price ?? h.avgCost;
  const value = effective * h.units;
  const cost = h.avgCost * h.units;
  return { price, value, cost, valueBase: toBase(value, h.currency, fx), costBase: toBase(cost, h.currency, fx), dayChangeBase: toBase(dayChange, h.currency, fx), priced };
}

const LIQUID: AccountType[] = ["checking", "savings", "cash"];

export interface NetWorth {
  cash: number;
  // Cash parked in broker / crypto / pension accounts plus holdings.
  investments: number;
  holdings: number;
  assets: number;
  liabilities: number;
  total: number;
  invested: number;
  // Money FIRE can count on (investments + liquid cash + assets flagged for FIRE).
  fireAssets: number;
}

export function computeNetWorth(input: {
  accounts: readonly Account[];
  txs: readonly Transaction[];
  holdings: readonly Holding[];
  quotes: ReadonlyMap<string, Quote>;
  assets: readonly OtherAsset[];
  fx: FxTable | null;
}): NetWorth {
  let cash = 0;
  let investCash = 0;
  for (const a of input.accounts) {
    if (a.archived || !a.includeInNetWorth || a.deletedAt) continue;
    const b = toBase(accountBalance(a, input.txs), a.currency, input.fx);
    if (LIQUID.includes(a.type)) cash += b;
    else investCash += b;
  }
  let holdings = 0;
  let invested = 0;
  for (const h of input.holdings) {
    if (h.archived || h.deletedAt) continue;
    const key = holdingQuoteKey(h);
    const v = valueHolding(h, key ? input.quotes.get(key) : undefined, input.fx);
    holdings += v.valueBase;
    invested += v.costBase;
  }
  let assets = 0;
  let liabilities = 0;
  let fireExtra = 0;
  for (const a of input.assets) {
    if (!a.includeInNetWorth || a.deletedAt) continue;
    const v = toBase(a.value, a.currency, input.fx);
    if (a.kind === "asset") {
      assets += v;
      if (a.includeInFire) fireExtra += v;
    } else liabilities += v;
  }
  const investments = holdings + investCash;
  return {
    cash,
    investments,
    holdings,
    assets,
    liabilities,
    total: cash + investments + assets - liabilities,
    invested,
    fireAssets: cash + investments + fireExtra,
  };
}
