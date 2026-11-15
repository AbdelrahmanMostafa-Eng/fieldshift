# FieldShift verification record

What was tested against live services and by eye, and what was not. Last run: 15 November 2026, against a production build (`npm run build && next start`) in a cloud container with network access to the data hosts only.

## Phase 4: live data sources (all key-free)

| Source | How it was called | Result |
| --- | --- | --- |
| NASA POWER monthly climate | Raw API with `start=2001&end=2024` (four-digit years), then `/api/climate?lat=24.69&lon=46.72` | Pass. Raw response: 312 keys per parameter, including the annual `YYYY13` keys, `fill_value` -999.0. The parser ignores month 13 and maps -999 to null (unit tests). App route: 24 years (2002 to 2025), January 2002 = 12.7 °C, 0.09 mm/day, 15.43 MJ/m²/day, no gaps, no -999 left. |
| NASA POWER `T2M_MIN` | Same raw monthly request with `T2M_MIN` added | Pass. The monthly API returns it (Riyadh, January 2001: -0.06 °C). Now requested and shown as "frost nights" in the Seasons tab. |
| NASA GIBS capabilities | `WMTSCapabilities` (epsg3857/best), 5.8 MB, read 15 November 2026 | Pass. All four layers in `src/lib/gibs.ts` match: VIIRS NOAA-20 true colour (jpeg, Level9, daily to 2026-11-15), Blue Marble (jpeg, Level8, static), MODIS Terra LST day (png, Level7, daily to 2026-11-15), MODIS Terra NDVI 8-day (png, Level9, to 2026-11-14). |
| GIBS tiles | One tile per layer for yesterday (UTC) | Pass. 200 with the expected image type for all four. |
| Open-Meteo geocoding | Raw API and `/api/geocode?q=Riyadh` | Pass. "Riyadh, Riyadh Region, Saudi Arabia" at 24.68773, 46.72185 first. The raw shape (`results[]` with `name`, `latitude`, `longitude`, `admin1`, `country`; no `results` key when nothing matches) matches the fixtures in `src/lib/openmeteo.test.ts`. |
| Open-Meteo forecast | Raw API and `/api/weather?lat=24.69&lon=46.72` | Pass. 7 days of high, low, rain and ET0 as parallel `daily` arrays, the shape the fixtures use. |
| ExchangeRate-API open endpoint | `/api/fx` | Pass. 166 currencies per US dollar (SAR 3.75, EGP 53.44), updated 15 November 2026. Attribution shown under the results. |
| AWS terrain tiles (Terrarium) | One tile | Pass. 200, PNG, no key. |
| FAO EcoCrop | `EcoCrop_DB.csv` from github.com/OpenCLIM/ecocrop (2,568 records) | Pass. 52 records imported by `scripts/import-ecocrop.mjs`, each checked for order (min ≤ optimum ≤ max) and a crop cycle; the import stops on any missing value. |
| Place names | Bundled Natural Earth extract (`src/data/places.json`, public domain) | No network call. |

Note for anyone repeating this in a sandbox: Node's built-in `fetch` ignores `HTTPS_PROXY` unless started with `NODE_USE_ENV_PROXY=1` (Node 22.21 or later). Vercel needs nothing.

## Phase 5: quality

Measured with the Playwright and Chromium already on the machine (Lighthouse itself was not run, see "Not tested").

| Check | Result |
| --- | --- |
| Mobile load, 390 × 844, "Slow 4G" (150 ms, 1.6 Mbit/s) and 4× CPU throttling | First contentful paint 1.0 s, largest contentful paint 1.3 s, cumulative layout shift 0.003. About 950 ms of long tasks, mostly MapLibre (289 KB gzipped, already lazy-loaded) starting up with software WebGL. The globe canvas exists at 5.4 s; the intro text and buttons are usable from first paint. |
| Accessibility (DOM checks, English intro, English and Arabic with a place picked) | Every visible button, link, input, tab, switch and slider has an accessible name; no images without alt text; no duplicate ids; `lang` set; zoom not blocked; no text found below WCAG AA contrast on solid backgrounds. |
| Keyboard only | Tab order: language, skip intro, find my location, explore, then the globe and its controls (labels in the page language). After skipping, focus moves to the place search. Search, arrow down, Enter picks a place. Tabs follow the ARIA tabs pattern (arrow keys, mirrored in Arabic, Home and End) with a linked tab panel. Every stop showed a visible focus ring. |
| Screen-reader labels | The map canvas is announced with the full instruction ("Interactive Earth. Drag to turn it…"), map buttons in the page language, Atlas replies in a live log region, charts and planting windows as labelled images. |
| Right-to-left | No physical `left`/`right`/`ml`/`mr`/`pl`/`pr` utilities in components. The few physical positions left are screen or map coordinates (cursor ring, map labels, the flat-map pin by longitude, MapLibre padding computed per direction). Arabic checked by eye at 768 × 1024. |
| Location denied | "Location is blocked for this site. Allow it in the browser, or pick a place on the globe." |
| Offline | A banner says what still works; place search says it is unavailable; the banner clears on reconnect. |
| Failed climate request | Clear message and a working "Try again". |
| Reduced motion | The globe does not spin on its own (two frames 2 s apart are identical). |
| Dead code | Two unused translation keys removed from all 12 languages. |

## Checks run on the code
- `npm run typecheck`, `npm test` (166 tests), `npx eslint src` and `npm run build` pass.
- The assistant's seven evaluation prompts are unit tests in `src/lib/assistant/assistant.test.ts` and run with every test run, in English and Arabic, plus a test that Arabic Atlas names the top strategy exactly as the Arabic cards do. The assistant contains no AI model and makes no network call.
- Logic with its own tests: rotation engine (including crops without economics and the per-place fit), climatology, costs and return, seasons, frost months, planting windows, USDA texture classes, NASA POWER and Open-Meteo parsers, GIBS addresses, the crop library against its EcoCrop records, the CSV import, and translation key parity across 12 languages.

## Looked at in a browser on this machine
- Earlier phases: the globe in light, dark and Arabic at 390 × 844, 768 × 1024 and 1440 × 900; the flat fallback; the Phase 2 shell and Phase 3 tabs.
- This round: the crop library at 1440 × 900 (English) and 768 × 1024 (Arabic, right to left); Seasons with frost nights at 1440 × 900 in Russian (Cyrillic fonts) and 390 × 844 in dark mode; Costs at 390 × 844 in Turkish; Atlas at 1440 × 900 in Bengali; the intro at 390 × 844 in Swahili; the share card and icons.

## Not tested
- Lighthouse scores themselves: running Lighthouse needed a package download that was not allowed in this session. The numbers above come from the browser's own performance APIs under the same throttling.
- A real phone, real mobile data, frame rate on a mid-range phone, and a real screen reader (VoiceOver, TalkBack).
- The live Vercel deployment of this round: pushing to GitHub was refused (the Claude GitHub App is not installed on the repository), so these changes are not deployed yet.
- Languages other than English and Arabic by a native reader.

## Known limits, said plainly
- Crop temperature, rain and cycle limits come from FAO EcoCrop and describe the species, not a variety. The water need is EcoCrop's lowest optimal rainfall over the crop cycle; the season length used in scores is the midpoint of EcoCrop's cycle range.
- Yields, prices and costs are illustrative and exist for 10 of the 52 crops. Suggested strategies use only those 10; any crop can go in the farmer's own plan, where income shows "not available" until the farmer enters numbers.
- Soil guidance is qualitative, by USDA texture class. It does not change any score: only a soil test can raise confidence.
- Planting windows and crop fit come from monthly means. Frost nights use the month's lowest 2 m air temperature; ground frost can happen on slightly warmer nights.
- Scores are middle values across past seasons with a range. They are not a forecast and not a guarantee.
