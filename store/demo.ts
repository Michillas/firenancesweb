import { categoryId } from "@/core/domain/defaults";
import type { Transaction } from "@/core/domain/finance";
import { addDays, addMonthKey, dayInMonth, lastDay, monthOf, todayKey } from "@/core/logic/dates";
import { accountBalance, holdingQuoteKey, valueHolding } from "@/core/logic/networth";
import { netForMonth } from "@/core/logic/payroll";
import { occurrences } from "@/core/logic/recurrence";
import { seededRng } from "@/core/logic/rng";
import { seedCategories } from "./actions/finance";
import { refreshAllFeeds, refreshQuotes } from "./market";
import { accounts, assets, categories, events, fxRates, goals, holdings, plan, purchases, quotes, recurring, settings, snapshots, transactions } from "./stores";

type TxInput = Omit<Transaction, "id" | "createdAt" | "updatedAt" | "deletedAt">;

// A believable Spanish salaried user, six months of history. Deterministic (seeded), so the
// demo looks the same every time and in screenshots.
export function loadDemoData() {
  seedCategories();
  const today = todayKey();
  const rng = seededRng("firenances-demo");
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const between = (a: number, b: number) => Math.round((a + rng() * (b - a)) * 100) / 100;
  const start = addMonthKey(monthOf(today), -6);
  const opening = `${start}-01`;

  const bank = accounts.create({ name: "BBVA Nómina", type: "checking", institution: "BBVA", openingBalance: 2400, openingDate: opening, emoji: "🏦", color: "sky" });
  const savings = accounts.create({ name: "Cuenta remunerada", type: "savings", institution: "Trade Republic", openingBalance: 7800, openingDate: opening, emoji: "💶", color: "emerald", interestRate: 2 });
  const broker = accounts.create({ name: "MyInvestor (efectivo)", type: "broker", institution: "MyInvestor", openingBalance: 150, openingDate: opening, emoji: "📈", color: "violet" });
  accounts.create({ name: "Efectivo", type: "cash", openingBalance: 120, openingDate: opening, emoji: "👛", color: "amber" });

  plan.patch({
    payroll: { ...plan.get().payroll, grossAnnual: 55000, payments: 14, payday: 28, extraMonths: [6, 12], accountId: bank.id, extras: [{ id: "x1", name: "Clases particulares", monthly: 120 }] },
    fire: { ...plan.get().fire, birthYear: 1995, targetAge: 50 },
  });

  const budgets: Record<string, number> = { groceries: 350, restaurants: 150, shopping: 200, leisure: 80, transport: 90 };
  for (const [slug, monthlyBudget] of Object.entries(budgets)) categories.update(categoryId(slug), { monthlyBudget });

  const rec = (name: string, amount: number, day: number, slug: string, extra: Partial<Parameters<typeof recurring.create>[0]> = {}) =>
    recurring.create({ name, amount, startDate: dayInMonth(start, day), categoryId: categoryId(slug), accountId: bank.id, ...extra });
  const subs = [
    rec("Alquiler", 720, 1, "housing", { kind: "bill", emoji: "🏠", color: "indigo" }),
    rec("Gimnasio", 39.9, 3, "sport", { emoji: "🏋️", color: "lime" }),
    rec("Netflix", 13.99, 5, "subscriptions", { emoji: "🎬", color: "rose", url: "https://www.netflix.com/cancelplan" }),
    rec("Spotify", 11.99, 12, "subscriptions", { emoji: "🎧", color: "emerald" }),
    rec("iCloud+", 2.99, 18, "subscriptions", { emoji: "☁️", color: "sky" }),
    rec("Movistar fibra + móvil", 55, 20, "telecom", { kind: "bill", emoji: "📶", color: "teal" }),
    rec("Iberdrola", 62, 14, "utilities", { kind: "bill", emoji: "💡", color: "amber" }),
    rec("Aportación MyInvestor", 300, 2, "investing", { kind: "bill", emoji: "📈", color: "violet", notes: "Aportación periódica a los fondos indexados" }),
    rec("Seguro del coche", 420, 15, "insurance", { kind: "bill", cycle: "yearly", startDate: `${Number(today.slice(0, 4)) - 1}-02-15`, emoji: "🚗", color: "slate" }),
    rec("Amazon Prime", 49.9, 10, "subscriptions", { cycle: "yearly", startDate: `${Number(today.slice(0, 4)) - 1}-03-10`, emoji: "📦", color: "orange" }),
  ];
  recurring.create({ name: "Disney+", amount: 9.99, startDate: addDays(today, 4), trialUntil: addDays(today, 3), categoryId: categoryId("subscriptions"), accountId: bank.id, emoji: "🏰", color: "violet" });

  const txs: TxInput[] = [];
  const add = (date: string, amount: number, kind: Transaction["kind"], slug: string | null, description: string, extra: Partial<TxInput> = {}) => {
    if (date > today) return;
    txs.push({ date, amount, kind, currency: "EUR", accountId: bank.id, toAccountId: null, categoryId: slug ? categoryId(slug) : null, description, merchant: description, notes: "", tags: [], source: "manual", recurringId: null, excluded: false, ...extra });
  };

  for (let i = 0; i <= 6; i++) {
    const month = addMonthKey(start, i);
    const p = plan.get().payroll;
    add(dayInMonth(month, p.payday), Math.round(netForMonth(p, month)), "income", "salary", "Nómina ACME Software SL");
    add(dayInMonth(month, 6), 120, "income", "other-income", "Bizum clases particulares");
    add(dayInMonth(month, 30), between(11, 16), "income", "returns", "Intereses cuenta remunerada", { accountId: savings.id });
    for (let w = 0; w < 5; w++) add(dayInMonth(month, 2 + w * 6 + Math.floor(rng() * 3)), between(38, 95), "expense", "groceries", pick(["Mercadona", "Lidl", "Carrefour", "Mercadona"]));
    for (let k = 0; k < 3 + Math.floor(rng() * 4); k++) add(dayInMonth(month, 1 + Math.floor(rng() * 28)), between(9, 40), "expense", "restaurants", pick(["Bar Manolo", "Goiko", "Glovo", "Starbucks", "Taberna La Tagliatella", "Just Eat"]));
    add(dayInMonth(month, 1), 20, "expense", "transport", "Abono transporte Metro");
    if (rng() > 0.4) add(dayInMonth(month, 8 + Math.floor(rng() * 15)), between(8, 22), "expense", "transport", "Cabify");
    add(dayInMonth(month, 9 + Math.floor(rng() * 10)), between(35, 60), "expense", "transport", "Repsol gasolinera");
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) add(dayInMonth(month, 1 + Math.floor(rng() * 28)), between(12, 85), "expense", "shopping", pick(["Amazon", "Zara", "Decathlon", "IKEA", "MediaMarkt", "Primark"]));
    if (rng() > 0.3) add(dayInMonth(month, 10 + Math.floor(rng() * 15)), between(8, 35), "expense", "leisure", pick(["Cines Yelmo", "Steam", "Ticketmaster"]));
    if (rng() > 0.5) add(dayInMonth(month, 1 + Math.floor(rng() * 28)), between(4, 25), "expense", "health", "Farmacia");
    if (rng() > 0.6) add(dayInMonth(month, 1 + Math.floor(rng() * 28)), between(12, 20), "expense", "personal", "Peluquería");
    // Monthly transfer from the payroll account to the savings account.
    add(dayInMonth(month, 29), 300, "transfer", null, "Traspaso a cuenta remunerada", { toAccountId: savings.id });
  }
  const summer = addMonthKey(start, 3);
  add(dayInMonth(summer, 4), 124.8, "expense", "travel", "Ryanair");
  add(dayInMonth(summer, 5), 386, "expense", "travel", "Booking.com Lisboa");
  add(dayInMonth(summer, 12), 140, "expense", "gifts", "Regalo cumpleaños");

  // Past charges of recurring items, linked so they are not logged twice.
  for (const r of subs) {
    const dates = occurrences(r, opening, today);
    for (const date of dates) {
      add(date, r.amount, "expense", null, r.name, { categoryId: r.categoryId, recurringId: r.id, source: "recurring", ...(r.name.startsWith("Aportación") ? {} : {}) });
    }
    if (dates.length) recurring.update(r.id, { loggedThrough: dates[dates.length - 1] });
  }
  transactions.createMany(txs);

  holdings.create({ name: "Vanguard FTSE All-World UCITS ETF (Acc)", symbol: "VWCE.DE", isin: "IE00BK5BQT80", assetType: "etf", units: 92, avgCost: 128.4, currency: "EUR", targetWeight: 55, monthlyContribution: 250, region: "Global", sector: "Diversificado", accountId: broker.id, newsQuery: "Vanguard FTSE All-World VWCE" });
  holdings.create({ name: "iShares Core MSCI EM IMI UCITS ETF", symbol: "IS3N.DE", isin: "IE00BKM4GZ66", assetType: "etf", units: 60, avgCost: 44.1, currency: "EUR", targetWeight: 10, monthlyContribution: 50, region: "Emergentes", sector: "Diversificado", accountId: broker.id, newsQuery: "mercados emergentes MSCI EM" });
  holdings.create({ name: "Vanguard Global Stock Index Fund EUR Acc", isin: "IE00B03HCZ61", assetType: "index_fund", units: 95, avgCost: 55.4, currency: "EUR", targetWeight: 20, monthlyContribution: 100, region: "Desarrollados", sector: "Diversificado", newsQuery: "MSCI World índice bolsa" });
  holdings.create({ name: "Apple Inc.", symbol: "AAPL", assetType: "stock", units: 5, avgCost: 192.5, currency: "USD", targetWeight: 5, region: "EE. UU.", sector: "Tecnología" });
  holdings.create({ name: "Bitcoin", symbol: "BTC", priceId: "bitcoin", assetType: "crypto", units: 0.02, avgCost: 52000, currency: "EUR", targetWeight: 5, region: "Global", sector: "Cripto" });
  holdings.create({ name: "Plan de pensiones Indexa Más Rentabilidad Acciones", assetType: "pension", valuationMode: "value", invested: 1450, manualValue: 1600, currency: "EUR", targetWeight: 5, region: "Global", sector: "Pensiones" });

  assets.create({ name: "Coche (Seat Ibiza 2021)", kind: "asset", category: "vehicle", value: 9500, interestRate: -12, emoji: "🚗" });
  assets.create({ name: "Préstamo del coche", kind: "liability", category: "loan", value: 4200, interestRate: 6.5, monthlyPayment: 210, endDate: "2028-06-01", emoji: "💳" });

  goals.create({ name: "Fondo de emergencia", kind: "emergency", emoji: "🛟", target: 12000, accountId: savings.id, monthlyContribution: 0, expectedReturn: 2, priority: 1, color: "emerald", notes: "Se nutre del traspaso mensual de 300 € a la cuenta remunerada." });
  goals.create({ name: "Entrada del piso", kind: "house", emoji: "🏡", target: 22000, saved: 9000, deadline: "2031-12-31", monthlyContribution: 220, expectedReturn: 3, priority: 2, color: "indigo" });
  goals.create({ name: "Viaje a Japón", kind: "travel", emoji: "🗾", target: 2800, saved: 1700, deadline: `${Number(today.slice(0, 4)) + 1}-06-01`, monthlyContribution: 150, priority: 3, color: "rose" });

  purchases.create({ name: "Lavadora nueva", emoji: "🧺", price: 520, saved: 420, targetDate: addDays(today, 40), priority: 1, need: true, categoryId: categoryId("housing") });
  purchases.create({ name: "MacBook Air M5", emoji: "💻", price: 1399, saved: 700, targetDate: addDays(today, 300), priority: 2, url: "https://www.apple.com/es/macbook-air/" });
  purchases.create({ name: "Bicicleta de carretera", emoji: "🚴", price: 950, priority: 3, targetDate: addDays(today, 300) });

  events.create({ title: "Pasar la ITV", date: addDays(today, 45), kind: "reminder", amount: 45 });

  // Month-end net-worth history: cash is exact; investments walk back from today's cost basis
  // (contributions + a modest market path), so the chart joins today's value without a jump.
  const all = transactions.list();
  const investedNow = holdings.list().reduce((n, h) => n + (h.valuationMode === "units" ? h.units * h.avgCost : h.invested), 0);
  for (let i = 0; i < 6; i++) {
    const month = addMonthKey(start, i);
    const end = lastDay(month);
    const upto = all.filter((t) => t.date <= end);
    const cash = accounts.list().reduce((n, a) => n + (a.type === "broker" ? 0 : accountBalance(a, upto)), 0);
    const monthsBack = 6 - i;
    const invested = investedNow - monthsBack * 450;
    const investments = Math.round(invested * (1 + 0.004 * i + (rng() - 0.5) * 0.03));
    const liabilities = 4200 + monthsBack * 190;
    snapshots.upsert(`nw_${end}`, { date: end, cash, investments, assets: 9500, liabilities, total: cash + investments + 9500 - liabilities, invested });
  }

  void refreshQuotes({ force: true })
    .then(() => rescaleHistory(investedNow))
    .then(() => refreshAllFeeds());
}

// Once real quotes arrive, scale the synthetic investment history so it ends at today's market value.
function rescaleHistory(investedNow: number) {
  const fx = fxRates.get(settings.get().currency) ?? null;
  const quoteMap = new Map(quotes.list().map((q) => [q.id, q]));
  const value = holdings.list().reduce((n, h) => n + valueHolding(h, quoteMap.get(holdingQuoteKey(h) ?? ""), fx).valueBase, 0);
  const ratio = investedNow > 0 ? value / investedNow : 1;
  const today = todayKey();
  const rows = snapshots.list().filter((r) => r.date < today).sort((a, b) => a.date.localeCompare(b.date));
  rows.forEach((row, i) => {
    // Gains build up over the period instead of appearing on the last day.
    const factor = 1 + (ratio - 1) * (0.75 + (0.25 * i) / Math.max(1, rows.length - 1));
    const investments = Math.round(row.invested * factor);
    snapshots.update(row.id, { investments, total: row.cash + investments + row.assets - row.liabilities });
  });
}
