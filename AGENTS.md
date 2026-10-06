<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FireNances — project rules

Priority: `docs/ARCHITECTURE.md` > this file. Read the architecture doc before changing a contract.

## Hard constraints
- Respect the layers (`app -> features -> store -> core`, `components -> core/lib`). ESLint enforces them.
- `core/` is framework-free and unit-tested. New money logic (forecasts, taxes, projections, parsers) goes there, with tests.
- All persistent data goes through the stores in `store/stores.ts`. Components never touch IndexedDB or localStorage
  (except per-device UI prefs via `lib/use-local-value.ts`).
- The UI is Spanish-only for now: write user-facing strings in Spanish directly (no i18n layer). Numbers and dates
  go through `lib/format.ts` (`es-ES`), money through `useMoney()` (base currency + privacy mode).
- No hex colours in components; use the semantic tokens from `app/globals.css`. Chart series use `series(n)` /
  `--series-N` (validated categorical palette, fixed slot per entity, never by rank).
- The logo is `public/logo-arrow.png` masked with `--accent`. If the accent colour changes, regenerate the tab icon
  in the same colour: `npm run icon -- <hex>` (writes `app/icon.png` + `public/icon.png`).
- Do not copy props into state with effects (React Compiler lint). Mount dialogs only while open, key them by entity.
- Dates are local day keys (`core/logic/dates.ts`); never `toISOString().slice(0,10)` for a calendar day.
- AI and market outputs are education, not advice: keep the `Disclaimer` next to AI analyses; never "buy/sell" prompts.

## Adding things
- New collection: schema in `core/domain/*`, export from `core/domain/index.ts`, instance in `store/stores.ts`
  (`name` is a storage key: never rename), add it to `dataCollections` (backed up) or `cacheCollections`.
- New screen: `features/<name>/`, route in `app/(app)/<name>/page.tsx`, nav entry in `components/shell/nav-items.ts`.
- New AI task: prompt + zod schema in `core/ai/tasks.ts`; always through `gateway.chatJSON` (or `grounded.search`
  + `extractJson` for web-grounded answers, with a plain-chat fallback).
- New market source: parser in `core/market/*` with a fixture test, wire it in `core/market/service.ts`, allow it
  in `app/api/market/route.ts` and `PRICE_SOURCES`.

## Quality gates (all must pass)
`npm run typecheck && npm run lint && npm test && npm run build`
