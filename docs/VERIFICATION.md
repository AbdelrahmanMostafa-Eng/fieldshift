# FieldShift verification record

What was tested against live services and by eye, and what was not. Last run: 15 November 2026, against a production build (`npm run build && next start`) in a cloud container with network access to the data hosts only.

## Live data sources (all key-free), re-checked for this round

| Source | How it was called | Result |
| --- | --- | --- |
| NASA POWER monthly climate | `/api/climate?lat=30.04&lon=31.24` (Cairo) | Pass. 24 years (2002 to 2025) of `T2M`, `T2M_MIN`, `PRECTOTCORR` and `ALLSKY_SFC_SW_DWN` (MJ/m² per day). Month 13 (annual) ignored, -999 mapped to null (unit tests). |
| NASA POWER regional climatology | Raw API and `/api/zones?lat=30.04&lon=31.24` | Pass. One parameter per request, 9° × 9° box, native 0.5° × 0.625° grid, monthly means 2001 to 2025. `T2M`, `PRECTOTCORR` and `GWETROOT` each answered in about 0.6 s. `GWETROOT` (root-zone soil wetness) is -999 over open water and valid over land, checked cell by cell on the Nile delta coast, so it is used as the land mask: the Cairo box keeps 190 land cells of 285. |
| NASA GIBS tiles | One tile per layer for yesterday and for 30 days back (UTC), 18 requests | Pass. 200 with the expected image type for all 9 layers: VIIRS true colour, Blue Marble, MODIS land surface temperature, MODIS NDVI, MERRA-2 air temperature, MERRA-2 wind speed, MERRA-2 root-zone soil water, AIRS relative humidity, IMERG rain rate. Monthly layers and IMERG use GIBS's `default` time (newest image), because a date outside their range returns 404. |
| Open-Meteo geocoding | `/api/geocode?q=Nairobi` and the place search in the browser | Pass. "Nairobi, Nairobi County, Kenya" first. |
| Open-Meteo forecast and current conditions | `/api/weather`, `/api/current` | Partly blocked here: Open-Meteo answered 429 "Daily API request limit exceeded" to this container's shared outbound address for most calls. One browser run got a live reading (Cairo, New York: 2 °C, clear, updated 05:45 local, which matches 10:45 UTC). The parsers are tested against a saved real response; when the service refuses, the app says "Current conditions are not available right now" and the rest works. The deployed site calls from Vercel's own addresses. |
| ExchangeRate-API open endpoint | `/api/fx` | Pass. 166 currencies per US dollar, all of them with a rate. |
| AWS terrain tiles (Terrarium) | One tile | Pass. 200, PNG, no key. |
| FAO EcoCrop | `EcoCrop_DB.csv` from github.com/OpenCLIM/ecocrop (2,568 records) | Pass. 81 records imported by `scripts/import-ecocrop.mjs`, each checked for order (min ≤ optimum ≤ max), a crop cycle and soil texture classes; the import stops on any missing value. Rice, maize and sweet potato have no texture class in EcoCrop and show "not available". |

Not used, on purpose: the Google Weather API. It needs an API key and a billing account, and this free edition runs with zero keys. Current conditions come from Open-Meteo (no key, refreshed every 15 minutes while the page is open).

Note for anyone repeating this in a sandbox: Node's built-in `fetch` ignores `HTTPS_PROXY` unless started with `NODE_USE_ENV_PROXY=1` (Node 22.21 or later). Vercel needs nothing.

## This round's features, checked in Chromium at 1440 × 900

| Feature | What was seen |
| --- | --- |
| Crop suggestions for the place | Six best-fitting crops of the 81, with icon, score, Good/Possible/Poor dot and best planting month; "add to plan" and "show zones" buttons. |
| Suitability zones (green, yellow, red) | Cairo: rain-fed sorghum poor (red) across the Nile valley, as expected for about 25 mm of rain a year. Cairo, New York: onion good (green) across the region with a few "possible" cells in the Adirondacks; the Atlantic is left uncoloured. Legend states the bands (70 and 40), the grid and the data source. |
| Map types | Wind layer legend in metres per second; all five new layers listed with units and a note that monthly layers show NASA's latest month. |
| Plan editor | Past crops 0 to 5, planned seasons 1 to 5; add and remove work (3 → 4 → 3). Two pickers per row in the side panel so crop names stay readable (this was fixed in this round: three per row cut the names off). |
| Priorities | Low / Medium / High on all five priorities (weights 1, 3 and 6). |
| Currency search | Typing "yen" finds Japanese Yen in every language (English names are searched too); list sorted alphabetically in the page language. |
| Crop library | 162 icons drawn (81 crops); tomato card shows best and tolerated soils and the feeding notes, including calcium. |
| Fertiliser guidance | Principles only (soil test first, legumes and nitrogen, potassium for roots and tubers, sulfur for brassicas, calcium for fruiting crops, organic matter, 4R), with sources. No product names and no rates, by project rule. |
| Current conditions | Header line and Seasons card; graceful message when the service refuses. |
| Sunlight | Monthly sunlight row (NASA POWER all-sky surface shortwave) under the climate chart. |
| Languages | English, Persian, Thai, Finnish, Malay (full walk-through), Urdu, German, Ukrainian, Vietnamese, Arabic (place picked, suggestions shown): no missing strings, no console errors, no sideways scrolling. Persian and Urdu run right to left. Month names always use the Gregorian calendar, which the data uses (Persian would otherwise show Solar Hijri months). |

## Phase 2 and Phase 3 checklist (from `BUILD_PROMPT.md`)

| Item | State |
| --- | --- |
| Design tokens: 4/8 spacing, radii 6/10/16/24, motion 120/220/420 ms with one easing, paper grain at 3 to 4 %, `tabular-nums` on figures | Done (`src/app/globals.css`). |
| Controls: segmented, custom range with value bubble, switches, searchable crop combobox with family tags, native selects on touch, 44 px targets, focus rings | Done. |
| Cursor ring on fine pointers only, native cursor kept, no easing under reduced motion | Done (`CursorRing.tsx`). |
| One hand-drawn icon family | Done (`ui/Icon.tsx`, `ui/CropIcon.tsx`, 1.5 stroke on a 20 px grid). |
| Designed dark mode; fonts for Arabic, Devanagari, Bengali, CJK, Cyrillic and now Thai | Done. Urdu and Persian use the Arabic fonts. |
| Intro, results sheet, hand-built SVG charts with P10 to P90 bands, confidence meter, empty/loading/error states, language picker with native names and search | Done. |
| 3.1 Costs and return: line items, hectare/acre/feddan (1 feddan = 0.42 ha, FAO AQUASTAT), break-even, ±20 % sensitivity, roll-up across the rotation, saved on the device, "illustrative" defaults | Done. The roll-up now follows the plan's 1 to 5 seasons. |
| 3.2 Seasons: temperature, rain and solar by month, warm/cool/wet/dry rules, planting windows, 7-day forecast, frost from `T2M_MIN` | Done. Solar was missing until this round. |
| 3.3 Crop library: 40 or more sourced crops, search, family filter, details, add to plan | Done: 81 crops. |
| 3.4 Soil explorer: 12 USDA classes on a triangle, drainage, water holding, workability, suited crops, sources | Done, with suited crops from EcoCrop's texture classes. Not done: a numeric available-water range and a soil-adjusted water score. The citable table (FAO Irrigation and Drainage Paper 56) could not be opened from this container, and no number is added without checking it against its source. |
| 3.5 Assistant v2: soil, season calendar, compare, typo tolerance, copy, follow-up chips, declines dosing; evaluation set as unit tests | Done. Fertiliser questions now get the principles above and still decline doses. |
| First-pass translations, key parity test, honest note that Atlas answers in English and Arabic only | Done for 18 languages besides English and Arabic (Finnish and Malay added last, with all 81 crop names). |

## Checks run on the code
- `npm run typecheck`, `npm test` (252 tests), `npx eslint src` and `npm run build` pass.
- The assistant's evaluation prompts are unit tests in `src/lib/assistant/assistant.test.ts`. The assistant contains no AI model and makes no network call.
- Logic with its own tests: rotation engine (1 to 5 seasons, Low/Medium/High weights, crops without economics, per-place fit), suitability zones (including the land mask, on a real POWER extract), climatology (including sunlight), costs and return, seasons, frost months, planting windows, texture classes, fertiliser notes, NASA POWER and Open-Meteo parsers (including current conditions), GIBS addresses and time handling, the crop library against its EcoCrop records, the CSV import, and translation key parity across 20 languages.

## Not tested
- Lighthouse scores themselves (the package download was not allowed); earlier numbers came from the browser's performance APIs.
- A real phone, real mobile data and a real screen reader.
- Languages other than English and Arabic by a native reader.

## Known limits, said plainly
- Crop limits come from FAO EcoCrop and describe the species, not a variety.
- Yields, prices and costs are illustrative and exist for 10 of the 81 crops. Suggested strategies use only those 10; any crop can go in the farmer's own plan.
- Zones and suggestions use long-term monthly means on a grid of about 50 to 70 km. Fields inside one cell can differ. Grid cells on a coast count as land when POWER has a soil-wetness value for them.
- Soil guidance is qualitative and does not change any score.
- Fertiliser notes are principles, not a recommendation for a field.
- Scores are middle values across past seasons with a range. They are not a forecast and not a guarantee.
