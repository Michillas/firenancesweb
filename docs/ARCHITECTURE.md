# FireNances — Architecture

Single source of truth for structural decisions. Update it in the same change that alters a contract.

## 1. Goals

1. **Local-first, no bank connection.** Everything works offline in the browser; data is typed, imported from a
   CSV/PDF, or extracted by AI. No account.
2. **Testable money logic.** Every number the user relies on (balances, forecasts, IRPF, FIRE, schedules,
   parsers) is pure TypeScript in `core/` with unit tests.
3. **Free data and AI.** Market data from public endpoints through our own route; AI through free providers in a
   fallback chain. Nothing requires a paid key.
4. **Honest.** Approximations are labelled (IRPF estimate, approximate tax dates, model assumptions); AI output is
   education with sources when available, never a buy/sell instruction.

## 2. Layers

```
app/          Next.js routing (thin pages) + API routes: /api/ai/{chat,grounded,status}, /api/market
features/     One folder per screen (home, transactions, analysis, payroll, investments, ...)
components/   Shared UI: shell, ui kit (components/ui), charts (components/charts)
store/        Zustand stores, actions with side effects, React selectors, market + AI clients
core/         Framework-free: domain schemas, logic, AI gateway/tasks, market parsers, storage, platform
lib/          Helpers: formatting (es-ES), colours, pdf text extraction, server-only helpers
```

`app → features → store → core`; `components → core/lib`. ESLint (`no-restricted-imports`) fails the build on a
violation. `core/` imports nothing outside `core/`.

### Routes: public site vs app

- `app/(site)/` — public, server-rendered, indexable: `/` (landing, `features/landing/`) and `/privacidad`. No
  stores, no IndexedDB: these pages must never import `store/` (it self-hydrates on import).
- `app/(app)/` — the app (`/dashboard`, `/transactions`, …). Its layout mounts `AppProviders` (hydration, `BootGate`,
  settings effects) and sends `noindex`.
- SEO lives in the root layout metadata (`metadataBase` from `NEXT_PUBLIC_SITE_URL`), `lib/seo.ts#publicPage`
  (canonical + Open Graph per public page), `app/{robots,sitemap,manifest}.ts`, `app/opengraph-image.tsx`,
  `app/apple-icon.tsx` and `app/icons/[size]` (PWA icons). Generated images use `lib/brand-image.ts`.

## 3. Domain and persistence

- Schemas in `core/domain/*` (zod). Additive migrations: new fields get `.default()`.
- Collections (`store/stores.ts`): accounts, categories, transactions, recurring, holdings, assets, snapshots,
  goals, purchases, events, analyses (backed up) and quotes, feeds, fx (re-fetchable cache, not backed up).
  Docs: `settings`, `plan` (payroll, salary buckets, FIRE assumptions), `device` (AI keys, never exported).
- **Account balance = openingBalance + movements dated on/after openingDate.** "Set balance" moves
  `openingBalance`; importing old movements never changes today's balance.
- Transactions store a positive `amount` + `kind` (expense / income / transfer). Transfers move money between
  accounts and never count as spending. Expenses in categories of group `savings` count as "saved", not spent.
- Recurring items expand with `core/logic/recurrence.ts` (each date computed from the start date, so the 31st
  survives February). `logDueRecurring` turns due charges into transactions once (`loggedThrough`), never
  back-filling dates before the item was created.
- Net-worth snapshots: one row per day (`nw_YYYY-MM-DD`), recorded 2 s after any money-relevant change.
- Storage engine: IndexedDB, one record per entity, debounced writes, BroadcastChannel between tabs.

## 4. Core logic (`core/logic`)

| File | Responsibility |
| --- | --- |
| `networth.ts` | balances, holding valuation (quote / manual / cost, FX), net worth, price-source resolution |
| `portfolio.ts` | positions, weights, allocation, buy-only rebalancing |
| `cashflow.ts` | monthly summary, by category, top merchants, averages, budgets (projection trusted from day 10) |
| `forecast.ts` | month forecast (salary + extras + recurring, fixed charges, variable average, goals, purchases), 12-month cash projection, purchase waterfall, instalments |
| `payroll.ts` | Spanish gross→net 2026: SS 6.48 % capped, work-income reduction, general scale, family minimum, 12/14 payments |
| `projection.ts` | compound growth, months to target, required contribution, strategies, Monte Carlo (seeded) |
| `fire.ts` | FIRE / Lean / Fat / Barista / Coast numbers, years and age, levers |
| `tax-calendar.ts` | Spanish personal tax dates (+130/303 for the self-employed) |
| `agenda.ts` | merges every dated thing into one agenda (home, calendar, subscriptions) |
| `alerts.ts` | dashboard observations (budgets, unusual spend, trials, negative cash, goals, drift) |
| `csv.ts`, `categorize.ts`, `detect-recurring.ts` | bank CSV parsing, rules + learned categorisation, duplicate and subscription detection |

## 5. Market data (`core/market`, `/api/market`)

`createMarket(fetch)` wraps the providers with fallbacks: Nasdaq ⇄ Yahoo for tickers, FT markets data (`ftstock`,
symbols like `6702:TYO`, search + delayed quote + chart API) for every other exchange and as Yahoo-suffix fallback, justETF (ETFs) / FT
(funds) by ISIN, CoinGecko, Frankfurter FX, Google News RSS, Bluesky search, Nasdaq earnings/dividends. Yahoo
rate-limits per IP, so anything with an ISIN falls back to justETF/FT. The route validates input with zod,
caches in memory (quotes 5 min, history 1 h, events 6 h) and rate-limits per client. Clients refresh quotes every
15 min while open; feeds are cached 3 h per holding.

**Real time** (`store/live.ts`, started by the shell): crypto streams from Binance's public WebSocket
(`data-stream.binance.vision`, pair `<SYMBOL><currency>` or `<SYMBOL>USDT`, throttled to one write / 1.5 s);
US tickers are polled through `/api/market?op=live` (8 s server cache) every 15 s from 04:00 to 20:00 New York
time (pre, regular, after hours); European ETFs every 30 s from 08:00 to 22:00 Berlin time; FT-listed stocks every 60 s during their own exchange hours
(Tokyo, Stockholm, Madrid, Paris, Amsterdam, London; delayed ~15 min, flagged in the badge). Index funds (FT) only
publish a daily NAV. Polling pauses while the tab is hidden. Live writes set `quote.live` and `quote.tick`
(up/down) for the flash animation; the 15-min refresh skips quotes a live feed updated in the last 2 min; net-worth
snapshots are throttled (30 s) so ticking prices do not rewrite them constantly.

## 6. AI

The AI gateway (`core/ai/gateway.ts`): providers in the user's order, cooldowns on failure,
`chatJSON` repairs JSON. Tasks (`core/ai/tasks.ts`): statement → transactions (chunked), payslip, broker report →
holdings, holding analysis, portfolio brief, spending review, NAV lookup. `core/ai/grounded.ts` calls Gemini with
the Google Search tool when a Gemini key exists (directly or through `/api/ai/grounded`) and returns sources;
otherwise tasks fall back to plain chat over the headlines we fetched. The assistant (`core/ai/assistant.ts`)
returns validated actions only; deletions wait for confirmation, everything else can be undone.

## 7. UI conventions

- Visual language (2026-10, "SevenTeen finance panel" reference): neutral near-black, hairline grey borders, one
  emerald accent, light type (`--font-weight-*` overrides), cents in grey (`MoneyText`). Sidebar with search,
  sentence-case groups, count badges and a FIRE gauge; content sits in a bordered panel whose header strip
  (`PageHeader`) shows the section icon. Summary rows use `TrendCard` (corner area chart, tinted border).
- Area charts: soft gradient fill, glowing line, dashed crosshair, glass tooltip; single-series charts use
  `--chart-hero`, multi-series the validated green-led `--series-N` palette.
- Native form controls and `<dialog>`; dialogs mount only while open. `MoneyInput` accepts `1.234,56`.
- Charts (`components/charts`, recharts): one y-axis, recessive grid, crosshair tooltips, legends for ≥ 2 series,
  `--series-N` palette (green, blue, orange, aqua, yellow, magenta, violet, red; validated light + dark) with a
  fixed slot per entity (asset type, bucket).
- Spanish-only copy; `lib/format.ts` formats money, numbers and dates for `es-ES`.

## 8. Quality gates

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (layers + React Compiler rules)
npm test            # vitest: core logic, market parsers, AI gateway/tasks
npm run build       # production build
```
