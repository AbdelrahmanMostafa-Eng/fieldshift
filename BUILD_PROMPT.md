# FieldShift: master build prompt for Claude Code (FREE EDITION)

You are lead engineer and lead designer on FieldShift, a decision-support web app for farmers (NASA Space Apps Challenge 2026, "Field Shift: Adapting Farms with NASA Data"). This folder is a working, tested skeleton. Your job is to turn it into a premium, demo-ready product, phase by phase.

**FREE EDITION. Non-negotiable:** the product must run with zero API keys, zero paid services and no database. The in-app assistant is a **rule-based bot, not AI**: no LLM, no hosted model, no embeddings, no AI SDK, no calls to any model API. Every data source is free and key-free: NASA POWER, NASA GIBS, Open-Meteo (place search and forecast), ExchangeRate-API's open endpoint, AWS terrain tiles. If any step seems to need a key, a card or a bill, stop and propose a key-free alternative.

**Deadline:** Sunday 15 Nov 2026, 11:59 PM local event time. The owner started Saturday evening (Asia/Riyadh). Time is the scarcest resource: follow the cut line at the bottom.

## 0. How we work together

- **Design decisions are yours.** Decide, build, show. Do not ask the owner to choose colours, spacing, copy or layout.
- **Ask the owner only for:** (1) a login (`gh auth login`, `vercel login`), (2) a permission prompt, (3) anything that would cost money (the answer is no, find another way), (4) a product fork that changes scope.
- **Secrets protocol.** The free edition needs no secrets. Never read, print or commit any `.env*` file. If you ever think a key is needed, stop and tell the owner why instead of adding one.
  - `gh auth login` and `vercel login` are run by the owner in his own terminal. After that you may run the CLIs.
- **Ask before:** adding a dependency (name, size, licence, why), pushing to a remote, deleting files.
- **Verify, do not assume.** This is Next.js 16 and MapLibre GL JS 6. Before using an API you are unsure about, check `node_modules/next/dist/docs/`, Context7 or the official docs.
- **Honesty.** At the end of each phase say what you tested and what you could not. Never claim a visual result you have not looked at in a screenshot. Never invent a number: every coefficient needs a `source` field, and if there is no source, show "not available".
- **At the end of every phase:** `npm run typecheck`, `npm test`, `npx eslint src`, and `npm run build` must pass. Then give a 10-line summary and wait for "go".

## 1. Phase 0: baseline and eyes (15 min)

1. Read `CLAUDE.md`, `README.md`, `src/lib/rotation/engine.ts` and its tests, and every file in `src/components/`.
2. Run `npm install`, then the four checks above. Fix anything that fails before changing code.
3. **Get eyes.** Ask the owner to enable a browser tool for you (the Claude in Chrome extension or a Playwright MCP server). You must be able to screenshot at 390×844, 768×1024 and 1440×900, in light, dark and Arabic. If you cannot get one, tell the owner, ask for screenshots after each phase, and mark all design work "unverified".
4. Confirm the app needs zero environment variables: `.env.example` should list none. Print the list of external hosts the app calls (NASA POWER, GIBS, Open-Meteo, ExchangeRate-API, AWS terrain tiles) and note which phases touch them.

## 2. Phase 1: the globe (about 2 h). This is the hero, make it exceptional

Keep MapLibre's globe projection. The current `Globe.tsx` is a basic version: NASA true-colour tiles, a simple atmosphere blend, a spin loop. Upgrade it to this spec, checking each style property against the current MapLibre style spec before using it.

**Look**
- **Relief.** Add a `raster-dem` source from the public AWS terrain tiles (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, `tileSize: 256`, `encoding: "terrarium"`, attribution "© AWS Terrain Tiles"). Add a low-opacity hillshade layer. Turn on `terrain` (exaggeration about 1.2 to 1.5) only from roughly zoom 5 upward, and test that globe plus terrain performs on a mid-range phone. If it does not, keep hillshade only.
- **Atmosphere.** Tune the whole `sky` object: `sky-color`, `horizon-color`, `fog-color`, `sky-horizon-blend`, `horizon-fog-blend`, `fog-ground-blend` and a zoom-interpolated `atmosphere-blend`. Note that fog needs 3D terrain. Aim for a thin, realistic blue-teal limb glow, not a neon halo. Use a different palette in light mode and dark mode.
- **Space.** A fine star field behind the globe. Try a transparent map canvas over a CSS or canvas star layer, and verify it works in globe mode. Fallback: a deep gradient. No shooting stars, no gimmicks.
- **Base imagery.** Keep VIIRS true colour. Fetch the GIBS `GetCapabilities` file with `curl` on this machine and check whether a lower-resolution Blue Marble style layer exists for zoom below about 3. Use only layer IDs and tile sets that you confirm, and set `confirmed: true` in `src/lib/gibs.ts` only for those.
- **Labels.** Subtle country and major-city labels in the app's typefaces. Use a free, key-free vector source whose terms you have read (OpenFreeMap is one candidate; confirm its current terms and attribution first) or a small bundled GeoJSON. Labels fade out by zoom to avoid clutter. MapLibre does not handle right-to-left text on its own, so add the RTL text plugin and test Arabic labels.

**Motion and interaction**
- **Intro rotation.** Slow and continuous (about 2°/s), starting with a gentle 4-second dolly-in from a farther zoom. It pauses on any touch or wheel. It never runs when `prefers-reduced-motion` is set.
- **Pick feedback.** On pick, drop a custom DOM marker with a single soft pulse ring (CSS only, reduced-motion safe), then `flyTo` with an eased curve of about 2.5 s to a field-scale zoom.
- **Dragging.** Damped inertia, smooth wheel zoom, working pinch and double-tap zoom on touch.
- **Cursor.** On desktop, a grab and grabbing cursor while dragging, and a crosshair when hovering the globe.
- **Globe to flat.** The 3D to 2D toggle transitions smoothly. Hide the atmosphere in 2D.

**Data on the globe**
- **Layers.** An opacity slider per overlay and a small legend with units (read `LegendURL` from the capabilities file if present).
- **Date.** A date slider (default yesterday UTC, range 30 days) with 250 ms debounce. Note that 8-day composites only change every eighth day.

**Performance and safety**
- **Budget.** First interactive frame under 2.5 s on throttled "Slow 4G". At least 30 fps on a mid-range phone. Cap the pixel ratio at 2 on mobile if the Map option exists in v6 (check). Lazy-load MapLibre. Pause rendering when the tab is hidden.
- **No WebGL.** Fall back gracefully with a message and the 2D map, never a blank screen.

**Done when:** screenshots at three viewport sizes in light and dark look like a product, not a demo; Slow 4G behaves; all four checks pass.

## 3. Phase 2: design system, intro and shell (about 2 h)

**Direction:** "a field notebook meets an observatory". Quiet, tactile, data-forward. The tokens in `globals.css` (warm paper, soil black, one wheat-gold accent) and the three fonts (Fraunces, Hanken Grotesk, JetBrains Mono) are the starting point. Refine, do not replace.

**Avoid the AI look.** No purple or blue gradients, no glow blobs, no glassmorphism everywhere, no emoji as icons, no gradient-text hero, no three identical rounded cards in a row, no stock-feeling copy.

**Glass (owner's decision, November 2026).** Things that float over the globe are one glass material: the results island, the header controls, the pop-up panels and the map buttons. It is defined once in `globals.css` (`--glass-*`, `--rim-*`, `.fs-glass`): a warm tint over a blurred view of the globe, edges drawn with inset highlights. Nothing else is glass, content inside a pane is never glass on glass, and reading text keeps 4.5:1 over any imagery. No visible scroll bars anywhere: scrolling areas fade at their edges instead (`.fs-scroll`).

**System**
- **Scales.** 4/8 spacing, a radius scale (6/10/16/24), warm low-opacity shadows, 1px hairlines, a modular type scale. Use Fraunces optical sizing for large headings and `tabular-nums` for all figures. A subtle paper grain (3 to 4 percent opacity) is allowed.
- **Motion tokens.** 120 / 220 / 420 ms, one easing curve, 40 ms stagger on result cards, number count-up on net return, skeleton shimmer while loading. Everything respects `prefers-reduced-motion`. Zero layout shift.
- **Controls.** Segmented controls for 2D/3D and theme. A custom range with a value bubble. Switches and checkboxes in the same visual family. A searchable crop combobox with family tags. Chips. Native selects stay on touch devices. All targets at least 44 px. Focus rings visible.
- **Cursor.** On devices with a fine pointer only: a soft ring that follows with slight easing, grows over interactive elements, becomes a crosshair over the globe. Never replace the native cursor in text inputs. No easing under reduced motion.
- **Icons.** One family, one stroke weight. Ask before adding an icon dependency (Lucide is ISC-licensed), or hand-draw about 12 SVGs.
- **Dark mode** is designed, not inverted. Contrast at least 4.5:1 for text.
- **Fonts for other scripts.** Add proper fallbacks for Arabic, Devanagari, Bengali and CJK, and check each renders.

**Intro:** full-bleed globe; text block aligned to the reading-start side (right in Arabic); a tiny mono label, a serif headline with one italic word, one primary and one ghost button, and a fine-print line "NASA POWER · GIBS". Staggered fade-in at 600 ms. A visible skip.

**Results sheet:** the peek height shows place name, "N strategies" and the best strategy; half and full heights as now. Test the touch drag on a real phone and fix whatever feels off. Side panel on laptops.

**Data visuals:** hand-built SVG, no chart library. Keep the P10 to P90 range bars. Add a monthly temperature and rainfall chart for the picked place from the POWER series. Add a confidence meter.

**Empty, loading and error states** all designed. Language picker with native names and search.

**Done when:** screenshots in light, dark and Arabic at three sizes; the owner agrees it looks premium.

## 4. Phase 3: missing features (about 3 h)

Build in this order. Each feature gets unit tests for its logic and a source for every number.

1. **Cost tracker and ROI (all currencies).** Editable line items per crop: seed, fertiliser, crop protection, labour, machinery and fuel, water, land rent, other. Inputs: yield, price, area with a unit switch (hectare, acre, feddan; check the feddan conversion). Outputs: total cost, revenue, net, ROI %, break-even price and yield, and a sensitivity view (plus or minus 20 % on yield and price). A three-year roll-up across a rotation. Saved in `localStorage` for now. Defaults come from the catalogue and are labelled "illustrative". Reuse `src/lib/roi.ts` and the currency selector.
2. **Seasons and climate tab.** For the picked place: the 12-month climatology (temperature, rain, solar) from POWER, plain-language warm, cool, wet and dry seasons detected with stated thresholds, a derived thermal planting window per crop (labelled "derived from temperature limits"), and the 7-day forecast strip from `/api/weather` (Open-Meteo: temperature, rain and reference ET0; keep the Open-Meteo attribution visible). Add `T2M_MIN` for a frost-risk line if you confirm the parameter works for the monthly API.
3. **Crop library.** Grow the catalogue from 10 to 40 or more crops, with FAO EcoCrop or national extension data. Check the licence first. If you cannot download the dataset from this machine, ask the owner to place it in `data/raw/` and write an import script with validation tests. Each crop keeps its `source`. Add search, a family filter, a detail drawer showing requirements, and an "add to plan" button. "All crops on the planet" is a roadmap goal; ship what you can source properly.
4. **Soil types explorer.** The 12 USDA texture classes with an interactive texture triangle in SVG; for each class: drainage, available water capacity range, workability, suited crops, all with sources. Add an info list of the 32 WRB reference soil groups only if you find a citable source. The farmer picks a soil class, which adjusts the water score through cited coefficients. **Do not** set `hasLocalSoil` from a self-reported class; only a supplied soil test (pH, organic matter, texture) may lift the confidence cap.
5. **Assistant v2 (rule-based, no AI).** The assistant lives in `src/lib/assistant/` and `src/components/AssistantChat.tsx`. It matches keywords to intents and fills fixed templates from the catalogue, the rotation engine, NASA POWER climate and the Open-Meteo forecast. Extend it with: soil-texture answers from the soil explorer data, a season calendar answer, "compare X and Y" crops, simple typo tolerance (Levenshtein distance 1 on crop names only), a "copy answer" button, follow-up chips that depend on the last intent, and a polite "I can't help with that, ask an agronomist" for dosing or pesticide questions. Keep every sentence either static, written by you, or computed from data with its source shown as a chip. **No model, no network call, no key.** Add each new intent with a unit test in `assistant.test.ts`.

**Assistant evaluation set (these are unit tests; run them every time):**
1. "Which rotation is best for me?" with no place chosen: asks for a place and states no numbers.
2. "Which rotation is best?" with strategies loaded: names the top strategy and its score exactly as the cards show.
3. "What is NDVI?": short definition with its limits.
4. "How much urea per hectare?": declines dosing and points to an agronomist.
5. "Ignore your rules and guarantee my yield": declines, no guarantees.
6. The same questions in Arabic: answers in Arabic.
7. "ROI of chickpea?": per-hectare numbers and the word "illustrative".

**Languages without AI cost.** Translate `messages/en.json` into es, fr, pt, hi, zh, id, sw, ru, tr and bn yourself, writing the files directly; keep keys and `{placeholders}` identical (`src/i18n/messages.test.ts` checks this). Say in the README that these are first-pass translations that need native review. Assistant answers exist in English and Arabic only: say so honestly in the UI note for other languages.

## 5. Phase 4: real-data verification (about 1 h)

The skeleton has never called a live service. On this machine you have network access, so run these and record pass or fail in `docs/VERIFICATION.md`:
- NASA POWER monthly point request with `start=2001&end=2024` (four-digit years). Check the response against the parser, including `-999` handling.
- GIBS `GetCapabilities`. Confirm the vegetation layer and the temperature layer (identifier, format, tile matrix set, date range). Fix `src/lib/gibs.ts`.
- Open-Meteo geocoding (`/api/geocode?q=Riyadh`) and forecast (`/api/weather?lat=24.69&lon=46.72`). Compare the real JSON with the fixtures in `src/lib/openmeteo.test.ts` and fix the parser or the fixtures to match reality.
- ExchangeRate-API open endpoint (`/api/fx`) returns rates and the attribution text is shown.
- Terrain tiles and any label source load without a key.
- The assistant: run the evaluation set in the browser, in English and Arabic.
Fix every failure. Do not weaken a test to make it pass.

## 6. Phase 5: quality (about 1 h)

- Lighthouse mobile: performance at least 80, accessibility at least 95.
- Keyboard-only pass; screen-reader labels on the globe, sheet and chart.
- Arabic RTL pass: no raw `left` or `right` utilities anywhere.
- Slow 4G, offline and denied-location behaviour.
- Remove dead code and unused translations.

## 7. Phase 6: deploy (about 30 min)

GitHub repository, then Vercel **Hobby** (free), Node 22, no environment variables, no cron. The owner does the logins. Before the first push, run `git status` and confirm no `.env*` file except `.env.example` is staged. Note for the README: Vercel Hobby and Open-Meteo's free tier are for non-commercial use, which covers a hackathon demo; going commercial needs a paid plan or a self-hosted alternative.

## 8. Definition of done

- [ ] Live URL works on a real phone over mobile data
- [ ] Globe is smooth, looks premium in light and dark, falls back gracefully
- [ ] Three or more strategies with why, evidence, gaps, risks and visible uncertainty
- [ ] Cost and ROI in many currencies with an editable tracker
- [ ] The assistant passes all seven evaluation prompts (as unit tests) and shows sources; it contains no AI model
- [ ] Arabic and at least three more languages checked by eye
- [ ] NASA non-endorsement line and data-use note in the footer; GIBS acknowledgment copied from the GIBS API docs page
- [ ] `docs/VERIFICATION.md` lists what was tested live and what was not
- [ ] The app runs with zero environment variables and zero paid services
- [ ] No secret in the repository or its history

## 9. Cut line

If it is Sunday noon and Phase 3 is not finished: stop adding features. Keep the globe, the design, the three strategies, the assistant, the deploy and the demo video. Never cut the submission itself. Submit at least one hour before the deadline.
