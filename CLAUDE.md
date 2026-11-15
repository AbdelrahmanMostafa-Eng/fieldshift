# FieldShift: rules for Claude Code

Decision-support web app for farmers (NASA Space Apps 2026, "Field Shift"). Next.js 16 App Router, TypeScript strict, Tailwind v4, MapLibre, next-intl (cookie locale). FREE EDITION: no API keys, no database, no AI model.

## Start here
- The phased master plan, design brief and globe spec are in `BUILD_PROMPT.md`. Follow it phase by phase.
- Free edition: the app must run with zero environment variables. Do not add any paid API, key, database or AI/LLM call. The assistant is rule-based (`src/lib/assistant/`).
- Never read, print or commit any `.env*` file.

## Commands
- `npm run dev` | `npm run build` | `npm run typecheck` | `npm test` | `npx eslint src`
- Run typecheck, tests and lint before saying a task is done.

## Hard rules
- Read `node_modules/next/dist/docs/` before using a Next.js API you are unsure of. This is Next 16, not older versions.
- Every coefficient in `src/data/` has a `source` field. Never add a number without one.
- Every number the assistant says must come from the catalogue, the engine or fetched data, and show a source chip. No chemical dosing advice.
- Keep `cacheComponents` OFF (cookie-based locale in the root layout breaks prerendering with it on).
- Use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) so Arabic RTL works. No `left`/`right` utilities.
- Floating UI (island, header controls, pop-ups, map buttons) uses the one glass material in `globals.css` (`--glass-*`, `.fs-glass`, `.fs-chrome`). Do not invent a second one, and never show scroll bars (`.fs-scroll` fades the edges).
- The globe's sunlight is `src/components/globe/optics.ts`; its sun direction also feeds MapLibre's `light`, so change it in one place only.
- Footer must keep the NASA non-endorsement line and the data-use note.
- Code is a decision aid. Show uncertainty (bands, confidence, gaps). Never present a score as a guarantee.

## Layout
- `src/lib/rotation/` engine (pure, unit-tested) · `src/lib/power.ts` NASA POWER client/parser · `src/lib/gibs.ts` GIBS layers · `src/lib/openmeteo.ts` free geocoding and forecast · `src/lib/assistant/` rule-based bot
- `src/app/api/*` route handlers · `src/components/*` UI · `src/i18n/*` + `messages/*.json` translations
