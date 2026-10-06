import { describe, expect, it } from "vitest";
import { accountSchema, holdingSchema, recurringSchema, transactionSchema, type Transaction } from "../domain/finance";
import { payrollSchema } from "../domain/plan";
import { budgetStatus, monthlySummary } from "./cashflow";
import { guessCategory, isDuplicate, learnRules, matchCategoryName } from "./categorize";
import { closingBalance, detectMapping, parseAmount, parseCsv, parseDate, rowsToDrafts } from "./csv";
import { fireNumbers, firePlan } from "./fire";
import { forecastMonth, installmentPayment, projectCash } from "./forecast";
import { accountBalance, computeNetWorth, openingFor, resolveSource, valueHolding } from "./networth";
import { applyScale, estimatePayroll, netForMonth } from "./payroll";
import { positions, rebalance } from "./portfolio";
import { monthsToTarget, project, requiredMonthly, retirementSuccess, simulate } from "./projection";
import { monthlyEquivalent, nextOccurrence, occurrences, pendingCharges } from "./recurrence";
import { spanishTaxCalendar } from "./tax-calendar";
import { categorySchema } from "../domain/finance";

const now = "2026-10-06T10:00:00.000Z";
const base = { createdAt: now, updatedAt: now, deletedAt: null };
const tx = (p: Partial<Transaction> & { date: string; amount: number }): Transaction => transactionSchema.parse({ id: `t${Math.random()}`, ...base, ...p });
const cat = (id: string, name: string, extra: object = {}) => categorySchema.parse({ id, ...base, name, ...extra });

describe("recurrence", () => {
  const sub = recurringSchema.parse({ id: "r1", ...base, name: "Gym", amount: 30, startDate: "2026-01-31" });
  it("keeps the 31st after short months", () => {
    expect(occurrences(sub, "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("handles weekly and yearly cycles", () => {
    const weekly = { ...sub, cycle: "weekly" as const, startDate: "2026-10-01" };
    expect(occurrences(weekly, "2026-10-01", "2026-10-20")).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    const yearly = { ...sub, cycle: "yearly" as const, startDate: "2024-03-15", amount: 120 };
    expect(nextOccurrence(yearly, "2026-10-06")).toBe("2027-03-15");
    expect(monthlyEquivalent(yearly)).toBe(10);
  });
  it("only back-fills charges after the subscription was added", () => {
    expect(pendingCharges({ ...sub, startDate: "2020-01-05" }, "2026-10-06", "2026-09-01")).toEqual(["2026-09-05", "2026-10-05"]);
    expect(pendingCharges({ ...sub, startDate: "2020-01-05", loggedThrough: "2026-09-05" }, "2026-10-06", "2026-09-01")).toEqual(["2026-10-05"]);
  });
});

describe("balances and net worth", () => {
  const acc = accountSchema.parse({ id: "a1", ...base, name: "Banco", openingBalance: 1000, openingDate: "2026-09-01" });
  const txs = [
    tx({ date: "2026-08-30", amount: 999, accountId: "a1" }),
    tx({ date: "2026-09-02", amount: 200, accountId: "a1" }),
    tx({ date: "2026-09-03", amount: 1500, kind: "income", accountId: "a1" }),
    tx({ date: "2026-09-04", amount: 300, kind: "transfer", accountId: "a1", toAccountId: "a2" }),
  ];
  it("derives balance from opening + movements", () => {
    expect(accountBalance(acc, txs)).toBe(2000);
    expect(accountBalance({ id: "a2", openingBalance: 0, openingDate: "2026-01-01" }, txs)).toBe(300);
  });
  it("moves the opening balance to reconcile", () => {
    expect(openingFor(acc, txs, 2500)).toBe(1500);
  });
  it("values holdings by quote, manual price or cost", () => {
    const h = holdingSchema.parse({ id: "h1", ...base, name: "VOO", symbol: "VOO", units: 2, avgCost: 400, currency: "USD" });
    const q = { id: "q", ...base, source: "nasdaq", symbol: "VOO", name: "", price: 500, currency: "USD", change: 5, changePct: 1, asOf: now, history: [], historyAt: null, tick: null, live: false };
    const fx = { base: "EUR", rates: { USD: 1.25 } };
    const v = valueHolding(h, q, fx);
    expect(v.value).toBe(1000);
    expect(v.valueBase).toBe(800);
    expect(v.dayChangeBase).toBe(8);
    expect(valueHolding(h, undefined, fx).priced).toBe("cost");
    const nw = computeNetWorth({ accounts: [acc], txs, holdings: [h], quotes: new Map([["nasdaq:VOO", q]]), assets: [], fx });
    expect(nw.total).toBe(2800);
    expect(nw.invested).toBe(640);
  });
  it("picks a price source automatically", () => {
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "BTC", isin: "", assetType: "crypto" })).toBe("coingecko");
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "VWCE.DE", isin: "", assetType: "etf" })).toBe("yahoo");
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "VWCE.DE", isin: "IE00BK5BQT80", assetType: "etf" })).toBe("justetf");
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "", isin: "IE00B03HCZ61", assetType: "index_fund" })).toBe("ft");
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "AAPL", isin: "", assetType: "stock" })).toBe("nasdaq");
    expect(resolveSource({ priceSource: "auto", priceId: "", symbol: "6702:TYO", isin: "", assetType: "stock" })).toBe("ftstock");
  });
});

describe("portfolio rebalancing", () => {
  it("sends new money to underweight holdings only", () => {
    const mk = (id: string, avgCost: number, target: number) => holdingSchema.parse({ id, ...base, name: id, units: 1, avgCost, targetWeight: target, priceSource: "manual" });
    const rows = positions([mk("world", 800, 70), mk("em", 100, 20), mk("bonds", 100, 10)], new Map(), null);
    const plan = rebalance(rows, 100);
    const em = plan.find((p) => p.holding.id === "em")!;
    const world = plan.find((p) => p.holding.id === "world")!;
    expect(world.buy).toBe(0);
    expect(em.buy).toBeCloseTo((120 / 130) * 100, 5);
    expect(plan.reduce((n, p) => n + p.buy, 0)).toBeCloseTo(100, 5);
    expect(Math.round(world.drift)).toBe(10);
  });
});

describe("cash flow", () => {
  const cats = new Map([["inv", cat("inv", "Inversión", { group: "savings" })]]);
  const txs = [
    tx({ date: "2026-09-01", amount: 2000, kind: "income" }),
    tx({ date: "2026-09-05", amount: 500 }),
    tx({ date: "2026-09-06", amount: 300, categoryId: "inv" }),
    tx({ date: "2026-09-07", amount: 999, excluded: true }),
  ];
  it("separates spending from saving", () => {
    const [s] = monthlySummary(txs, ["2026-09"], cats, null);
    expect(s).toMatchObject({ income: 2000, expense: 500, saved: 300, net: 1200 });
    expect(s.savingsRate).toBe(75);
  });
  it("projects budgets linearly", () => {
    const food = cat("food", "Comida", { monthlyBudget: 300 });
    const spent = [tx({ date: "2026-10-03", amount: 150, categoryId: "food" })];
    const [early] = budgetStatus([food], spent, "2026-10", "2026-10-06", null);
    // Too early in the month to trust a projection.
    expect(early.status).toBe("ok");
    expect(Math.round(early.projected)).toBe(775);
    const [later] = budgetStatus([food], spent, "2026-10", "2026-10-12", null);
    expect(later.status).toBe("warning");
  });
});

describe("Spanish payroll", () => {
  it("applies the progressive scale", () => {
    expect(applyScale(12450)).toBeCloseTo(2365.5, 2);
    expect(applyScale(20200)).toBeCloseTo(4225.5, 2);
  });
  it("estimates a 30k salary in 14 payments", () => {
    const e = estimatePayroll({ grossAnnual: 30000, payments: 14, children: 0, irpfRate: null, ssRate: 6.48 });
    expect(e.irpfRate).toBeGreaterThan(15);
    expect(e.irpfRate).toBeLessThan(18);
    expect(e.netAnnual).toBeCloseTo(30000 - e.socialSecurity - e.irpf, 5);
    expect(e.netExtraMonth).toBeGreaterThan(e.netMonthly * 1.8);
  });
  it("does not withhold IRPF on a low salary", () => {
    expect(estimatePayroll({ grossAnnual: 15000, payments: 14, children: 0, irpfRate: null, ssRate: 6.48 }).irpfRate).toBe(0);
  });
  it("pays the extra in June and December", () => {
    const p = payrollSchema.parse({ grossAnnual: 28000, payments: 14 });
    expect(netForMonth(p, "2026-06")).toBeGreaterThan(netForMonth(p, "2026-05") * 1.8);
  });
});

describe("forecast", () => {
  it("predicts free money after fixed and variable spending", () => {
    const rent = recurringSchema.parse({ id: "rent", ...base, name: "Alquiler", kind: "bill", amount: 800, startDate: "2026-01-01" });
    const history = ["2026-07", "2026-08", "2026-09"].map((m) => tx({ date: `${m}-10`, amount: 300, categoryId: "food" }));
    const f = forecastMonth({
      month: "2026-10",
      today: "2026-10-06",
      txs: [...history, tx({ date: "2026-10-03", amount: 100, categoryId: "food" })],
      recurring: [rent],
      categories: [],
      payroll: payrollSchema.parse({ netMonthlyOverride: 2000, payments: 12 }),
      goals: [],
      purchases: [],
      fx: null,
    });
    expect(f.fixedTotal).toBe(800);
    expect(f.variablePredicted).toBe(300);
    expect(f.free).toBe(900);
  });
  it("projects cash month by month", () => {
    const cash = projectCash({ start: "2026-10", months: 3, startBalance: 1000, txs: [], recurring: [], payroll: payrollSchema.parse({ netMonthlyOverride: 1000, payments: 12 }), outflows: 200, fx: null });
    expect(cash.map((c) => c.balance)).toEqual([1800, 2600, 3400]);
  });
  it("computes instalments", () => {
    expect(installmentPayment(1200, 12, 0)).toBe(100);
    expect(installmentPayment(1200, 12, 12)).toBeCloseTo(106.62, 2);
  });
});

describe("projections and FIRE", () => {
  it("compounds monthly contributions", () => {
    const p = project({ initial: 0, monthly: 100, annualReturn: 0, years: 2 });
    expect(p.at(-1)!.value).toBe(2400);
    expect(requiredMonthly(0, 2400, 24, 0)).toBe(100);
    expect(monthsToTarget(0, 100, 0, 1000)).toBe(10);
  });
  it("computes FIRE targets", () => {
    const n = fireNumbers(24000, { withdrawalRate: 4, leanFactor: 0.7, fatFactor: 1.5, baristaIncome: 12000 });
    expect(n).toEqual({ fire: 600000, lean: 420000, fat: 900000, barista: 300000 });
    const plan = firePlan({ s: { birthYear: 1996, targetAge: 50, annualExpenses: null, withdrawalRate: 4, expectedReturn: 7, inflation: 2.5, volatility: 15, monthlyContribution: null, leanFactor: 0.7, fatFactor: 1.5, baristaIncome: 12000, pension: 0, pensionAge: 67 }, annualExpenses: 24000, current: 50000, monthly: 1000, thisYear: 2026 });
    expect(plan.currentAge).toBe(30);
    expect(plan.yearsTo.fire).toBeGreaterThan(15);
    expect(plan.yearsTo.lean!).toBeLessThan(plan.yearsTo.fire!);
  });
  it("runs reproducible Monte Carlo simulations", () => {
    const a = simulate({ initial: 100000, monthly: 1000, years: 20, annualReturn: 7, volatility: 15, inflation: 2, target: 600000, paths: 300, seed: "x" });
    const b = simulate({ initial: 100000, monthly: 1000, years: 20, annualReturn: 7, volatility: 15, inflation: 2, target: 600000, paths: 300, seed: "x" });
    expect(a.successAtEnd).toBe(b.successAtEnd);
    expect(a.bands[20].p90).toBeGreaterThan(a.bands[20].p10);
    expect(retirementSuccess({ portfolio: 1_000_000, annualWithdrawal: 30000, years: 30, annualReturn: 6, volatility: 12, inflation: 2, paths: 300 })).toBeGreaterThan(80);
  });
});

describe("imports", () => {
  it("parses Spanish bank CSVs", () => {
    const csv = "Fecha;Concepto;Importe;Saldo\n03/10/2026;COMPRA MERCADONA VALENCIA;-45,30;1.200,00\n01/10/2026;ABONO NOMINA EMPRESA SL;1.850,00;1.245,30\n";
    const rows = parseCsv(csv);
    const mapping = detectMapping(rows)!;
    expect(mapping.amount).toBe(2);
    expect(closingBalance(rows, mapping)).toBe(1200);
    const drafts = rowsToDrafts(rows, mapping);
    expect(drafts).toEqual([
      { date: "2026-10-03", amount: 45.3, kind: "expense", description: "COMPRA MERCADONA VALENCIA", merchant: "" },
      { date: "2026-10-01", amount: 1850, kind: "income", description: "ABONO NOMINA EMPRESA SL", merchant: "" },
    ]);
  });
  it("parses numbers and dates in many formats", () => {
    expect(parseAmount("1.234,56 €")).toBe(1234.56);
    expect(parseAmount("-1,234.56")).toBe(-1234.56);
    expect(parseAmount("(12.50)")).toBe(-12.5);
    expect(parseDate("2026-10-03")).toBe("2026-10-03");
    expect(parseDate("3-10-26")).toBe("2026-10-03");
    expect(parseDate("31/02/x")).toBeNull();
  });
  it("categorises from history first, then keywords", () => {
    const cats = [cat("cat_groceries", "Supermercado", { keywords: ["mercadona"] }), cat("cat_rest", "Restaurantes", { keywords: ["bar "] })];
    const rules = learnRules([tx({ date: "2026-01-01", amount: 1, description: "Bar Pepe", categoryId: "cat_groceries" })]);
    expect(guessCategory({ description: "COMPRA MERCADONA 1234", kind: "expense" }, cats, new Map())).toBe("cat_groceries");
    expect(guessCategory({ description: "BAR PEPE", kind: "expense" }, cats, rules)).toBe("cat_groceries");
    expect(matchCategoryName("restaurantes 🍽️", cats, "expense")).toBe("cat_rest");
    expect(isDuplicate({ date: "2026-01-01", amount: 1, kind: "expense", description: "bar pepe" }, [tx({ date: "2026-01-01", amount: 1, description: "Bar Pepe" })])).toBe(true);
  });
});

describe("tax calendar", () => {
  it("adds self-employed quarters only when asked", () => {
    expect(spanishTaxCalendar(2027, { selfEmployed: false }).some((d) => d.selfEmployedOnly)).toBe(false);
    expect(spanishTaxCalendar(2027, { selfEmployed: true }).filter((d) => d.selfEmployedOnly)).toHaveLength(4);
  });
});

describe("recurring detection", () => {
  it("spots a monthly charge with a stable amount", async () => {
    const { detectRecurring } = await import("./detect-recurring");
    const txs = ["2026-07-03", "2026-08-03", "2026-09-02", "2026-10-03"].map((d) => tx({ date: d, amount: 12.99, description: "NETFLIX.COM 1234" }));
    const noise = ["2026-07-10", "2026-09-25"].map((d) => tx({ date: d, amount: 40, description: "Restaurante" }));
    const s = detectRecurring([...txs, ...noise], [], "2026-10-06");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ cycle: "monthly", amount: 12.99, nextDate: "2026-11-03" });
  });
});

describe("agenda", () => {
  it("merges payday, charges, taxes and market events", async () => {
    const { buildAgenda } = await import("./agenda");
    const rent = recurringSchema.parse({ id: "rent", ...base, name: "Alquiler", kind: "bill", amount: 800, startDate: "2026-01-01" });
    const items = buildAgenda({
      from: "2026-06-01",
      to: "2026-06-30",
      recurring: [rent],
      payroll: payrollSchema.parse({ grossAnnual: 30000, payday: 28 }),
      purchases: [],
      goals: [],
      events: [],
      holdings: [holdingSchema.parse({ id: "h", ...base, name: "Apple", units: 2 })],
      feeds: [{ id: "h", ...base, holdingId: "h", news: [], social: [], fetchedAt: null, events: [{ date: "2026-06-12", kind: "dividend_payment", title: "", amount: 0.26, estimated: false }] }],
      tax: { enabled: true, selfEmployed: false },
    });
    expect(items.map((i) => i.kind)).toEqual(["charge", "market", "tax", "payday", "tax"]);
    expect(items.find((i) => i.kind === "payday")!.title).toContain("extra");
    expect(items.find((i) => i.kind === "market")!.amount).toBeCloseTo(0.52);
  });
});

describe("purchase waterfall", () => {
  it("funds purchases by priority", async () => {
    const { schedulePurchases } = await import("./forecast");
    const { purchaseSchema } = await import("../domain/finance");
    const a = purchaseSchema.parse({ id: "a", ...base, name: "Lavadora", price: 500, priority: 1 });
    const b = purchaseSchema.parse({ id: "b", ...base, name: "Portátil", price: 1000, saved: 100, priority: 2, targetDate: "2026-12-01" });
    const s = schedulePurchases([b, a], 300, "2026-10-06");
    expect(s.map((x) => [x.purchase.id, x.monthsNeeded])).toEqual([["a", 2], ["b", 5]]);
    expect(s[1].onTime).toBe(false);
  });
});
