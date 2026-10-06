import { z } from "zod";
import { entityShape } from "./base";
import { CURRENCIES } from "./settings";

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite();
const currency = z.enum(CURRENCIES).default("EUR");

// ---- Accounts -------------------------------------------------------------------------------
export const ACCOUNT_TYPES = ["checking", "savings", "cash", "broker", "crypto", "pension", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Balance = openingBalance + every transaction of this account dated on/after openingDate.
// "Set balance" moves openingBalance so the derived balance matches what the bank shows.
export const accountSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES).default("checking"),
  institution: z.string().default(""),
  currency,
  openingBalance: money.default(0),
  openingDate: dayKey,
  color: z.string().default("sky"),
  emoji: z.string().default("🏦"),
  includeInNetWorth: z.boolean().default(true),
  archived: z.boolean().default(false),
  // Annual interest (savings accounts), used by projections.
  interestRate: z.number().default(0),
  notes: z.string().default(""),
});
export type Account = z.infer<typeof accountSchema>;

// ---- Categories -----------------------------------------------------------------------------
export const CATEGORY_KINDS = ["expense", "income"] as const;
// 50/30/20 bucket the category belongs to (drives the payroll plan).
export const CATEGORY_GROUPS = ["needs", "wants", "savings", "income"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const categorySchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  emoji: z.string().default("📦"),
  color: z.string().default("slate"),
  kind: z.enum(CATEGORY_KINDS).default("expense"),
  group: z.enum(CATEGORY_GROUPS).default("wants"),
  monthlyBudget: z.number().nullable().default(null),
  // Lower-case words that auto-assign this category on import ("mercadona", "renfe" ...).
  keywords: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
  order: z.number().default(0),
});
export type Category = z.infer<typeof categorySchema>;

// ---- Transactions ---------------------------------------------------------------------------
export const TX_KINDS = ["expense", "income", "transfer"] as const;
export type TxKind = (typeof TX_KINDS)[number];
export const TX_SOURCES = ["manual", "ai", "csv", "recurring", "assistant"] as const;

export const transactionSchema = z.object({
  ...entityShape,
  date: dayKey,
  // Always positive; `kind` gives the sign.
  amount: z.number().nonnegative(),
  kind: z.enum(TX_KINDS).default("expense"),
  currency,
  accountId: z.string().nullable().default(null),
  // Transfers only.
  toAccountId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  description: z.string().default(""),
  merchant: z.string().default(""),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
  source: z.enum(TX_SOURCES).default("manual"),
  recurringId: z.string().nullable().default(null),
  // Left out of statistics (refunds between friends, one-off noise...).
  excluded: z.boolean().default(false),
});
export type Transaction = z.infer<typeof transactionSchema>;

// ---- Recurring charges (subscriptions and bills) -------------------------------------------
export const CYCLES = ["weekly", "monthly", "quarterly", "semiannual", "yearly"] as const;
export type Cycle = (typeof CYCLES)[number];
export const RECURRING_KINDS = ["subscription", "bill", "income"] as const;

export const recurringSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  kind: z.enum(RECURRING_KINDS).default("subscription"),
  amount: z.number().nonnegative(),
  currency,
  cycle: z.enum(CYCLES).default("monthly"),
  every: z.number().int().min(1).default(1),
  // First charge; later charges follow the cycle (day-of-month clamps to short months).
  startDate: dayKey,
  endDate: dayKey.nullable().default(null),
  trialUntil: dayKey.nullable().default(null),
  accountId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  emoji: z.string().default("🔁"),
  color: z.string().default("violet"),
  url: z.string().default(""),
  notes: z.string().default(""),
  active: z.boolean().default(true),
  // Creates the transaction automatically when the charge date passes.
  autoLog: z.boolean().default(true),
  // Last charge date already turned into a transaction.
  loggedThrough: dayKey.nullable().default(null),
});
export type Recurring = z.infer<typeof recurringSchema>;

// ---- Investments ----------------------------------------------------------------------------
export const ASSET_TYPES = ["index_fund", "etf", "stock", "crypto", "bond", "reit", "commodity", "pension", "cash", "other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const PRICE_SOURCES = ["auto", "yahoo", "nasdaq", "ftstock", "justetf", "ft", "coingecko", "manual"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
// units: units * price.  value: the user types the current value (funds without a public quote).
export const VALUATION_MODES = ["units", "value"] as const;

export const holdingSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  symbol: z.string().default(""),
  isin: z.string().default(""),
  assetType: z.enum(ASSET_TYPES).default("etf"),
  priceSource: z.enum(PRICE_SOURCES).default("auto"),
  // Provider id when it differs from the symbol (CoinGecko "bitcoin", Yahoo "VWCE.DE").
  priceId: z.string().default(""),
  valuationMode: z.enum(VALUATION_MODES).default("units"),
  units: z.number().nonnegative().default(0),
  // Average cost per unit (units mode) or total invested (value mode), in the holding currency.
  avgCost: z.number().nonnegative().default(0),
  invested: z.number().nonnegative().default(0),
  manualPrice: z.number().nullable().default(null),
  manualValue: z.number().nullable().default(null),
  currency,
  accountId: z.string().nullable().default(null),
  // Desired share of the portfolio (0-100), for rebalancing.
  targetWeight: z.number().min(0).max(100).nullable().default(null),
  monthlyContribution: z.number().nonnegative().default(0),
  region: z.string().default(""),
  sector: z.string().default(""),
  // Words used to search news and social posts (defaults to name + symbol).
  newsQuery: z.string().default(""),
  notes: z.string().default(""),
  archived: z.boolean().default(false),
});
export type Holding = z.infer<typeof holdingSchema>;

// ---- Other assets and debts -----------------------------------------------------------------
export const ASSET_KINDS = ["asset", "liability"] as const;
export const ASSET_CATEGORIES = ["real_estate", "vehicle", "valuables", "receivable", "business", "other_asset", "mortgage", "loan", "credit_card", "other_debt"] as const;

export const assetSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  kind: z.enum(ASSET_KINDS).default("asset"),
  category: z.enum(ASSET_CATEGORIES).default("other_asset"),
  value: z.number().nonnegative().default(0),
  currency,
  // Debts: annual interest, monthly payment and payoff date; assets: yearly appreciation.
  interestRate: z.number().default(0),
  monthlyPayment: z.number().nonnegative().default(0),
  endDate: dayKey.nullable().default(null),
  includeInNetWorth: z.boolean().default(true),
  // FIRE usually excludes the home you live in: it does not pay for your expenses.
  includeInFire: z.boolean().default(false),
  emoji: z.string().default("🏠"),
  notes: z.string().default(""),
});
export type OtherAsset = z.infer<typeof assetSchema>;

// ---- Net-worth history ----------------------------------------------------------------------
// One row per day (id nw_YYYY-MM-DD); the latest value of the day wins.
export const snapshotSchema = z.object({
  ...entityShape,
  date: dayKey,
  cash: money.default(0),
  investments: money.default(0),
  assets: money.default(0),
  liabilities: money.default(0),
  total: money.default(0),
  invested: money.default(0),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

// ---- Goals and planned purchases ------------------------------------------------------------
export const GOAL_KINDS = ["emergency", "house", "car", "travel", "education", "retirement", "wedding", "other"] as const;

export const goalSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  kind: z.enum(GOAL_KINDS).default("other"),
  emoji: z.string().default("🎯"),
  color: z.string().default("emerald"),
  target: z.number().nonnegative(),
  saved: z.number().nonnegative().default(0),
  // When linked, "saved" is the account balance.
  accountId: z.string().nullable().default(null),
  deadline: dayKey.nullable().default(null),
  monthlyContribution: z.number().nonnegative().default(0),
  // Expected annual return of where the money sits (0 for a current account).
  expectedReturn: z.number().default(0),
  priority: z.number().int().min(1).max(3).default(2),
  done: z.boolean().default(false),
  notes: z.string().default(""),
});
export type Goal = z.infer<typeof goalSchema>;

export const PURCHASE_STATUS = ["planned", "bought", "discarded"] as const;

export const purchaseSchema = z.object({
  ...entityShape,
  name: z.string().min(1),
  emoji: z.string().default("🛍️"),
  price: z.number().nonnegative(),
  currency,
  saved: z.number().nonnegative().default(0),
  targetDate: dayKey.nullable().default(null),
  priority: z.number().int().min(1).max(3).default(2),
  status: z.enum(PURCHASE_STATUS).default("planned"),
  categoryId: z.string().nullable().default(null),
  url: z.string().default(""),
  // Financing: 0 = pay in full; otherwise number of monthly instalments at `apr`.
  installments: z.number().int().min(0).default(0),
  apr: z.number().min(0).default(0),
  // "Need" vs "want" (anti-impulse: 30-day rule for wants).
  need: z.boolean().default(false),
  notes: z.string().default(""),
  boughtAt: dayKey.nullable().default(null),
});
export type Purchase = z.infer<typeof purchaseSchema>;

// ---- Calendar -------------------------------------------------------------------------------
export const EVENT_KINDS = ["tax", "payment", "reminder", "market", "other"] as const;

export const calendarEventSchema = z.object({
  ...entityShape,
  title: z.string().min(1),
  date: dayKey,
  kind: z.enum(EVENT_KINDS).default("reminder"),
  amount: z.number().nullable().default(null),
  notes: z.string().default(""),
  done: z.boolean().default(false),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
