# FieldShift verification record

What was tested against live services and by eye, and what was not. Last run: 15 November 2026 (local), from the development server on this machine.

## Live data sources (all key-free)

| Source | How it was called | Result |
| --- | --- | --- |
| NASA POWER monthly climate | `/api/climate?lat=24.69&lon=46.72` (four-digit years, 2002 to 2025) | Pass. 24 years returned, values parse (January 2002: 12.7 °C, 0.09 mm/day, 15.43 MJ/m²/day), no `-999` left in the parsed series, no gaps at this point. |
| NASA GIBS capabilities | `WMTSCapabilities.xml` (epsg3857/best), read on 14 November 2026 | Pass. Layer ids, formats, tile matrix sets and date ranges in `src/lib/gibs.ts` were copied from it. The SNPP true-colour layer ended on 2 November 2026, so NOAA-20 is used. |
| GIBS tiles | One tile each for VIIRS NOAA-20 true colour, Blue Marble, MODIS land surface temperature and MODIS NDVI 8-day (yesterday, UTC) | Pass. All four answer 200 with the expected image type. Some NDVI tiles with no data answer 500; the map keeps what it has. |
| Open-Meteo geocoding | `/api/geocode?q=Riyadh` | Pass. "Riyadh, Riyadh Region, Saudi Arabia" at 24.69, 46.72 comes first. |
| Open-Meteo forecast | `/api/weather?lat=24.69&lon=46.72` | Pass. 7 days with high, low, rain and reference evapotranspiration (ET0). Attribution is shown in the Seasons tab and the footer. |
| ExchangeRate-API open endpoint | `/api/fx` | Pass. 166 currencies per US dollar (SAR 3.75). Attribution is shown under the results. |
| AWS terrain tiles (Terrarium) | One tile from `elevation-tiles-prod` | Pass. 200, PNG, no key. |
| Place names | Bundled Natural Earth extract (`src/data/places.json`, public domain) | No network call. |

## Checks run on the code
- `npm run typecheck`, `npm test` (90 tests) and `npx eslint src` pass. `npm run build` passes.
- The assistant's seven evaluation prompts are unit tests in `src/lib/assistant/assistant.test.ts` and run with every test run, in English and Arabic. The assistant contains no AI model and makes no network call.
- Logic with its own tests: rotation engine, climatology, costs and return, seasons, planting windows, USDA texture classes, NASA POWER and Open-Meteo parsers, GIBS addresses.

## Looked at in a browser on this machine
- Globe (Phase 1): light and dark, Arabic, at 390 x 844, 768 x 1024 and 1440 x 900; the flat fallback when WebGL is off; relief in a production build; the 2D/3D change at 60 frames per second.
- New shell (Phase 2): intro and main view at 1440 x 900 in dark, and the phone header and sheet at 390 x 844 in light.
- Phase 3 tabs (Seasons, Costs, Crops, Soil, Ask Atlas): each opens with real content at 390 x 844, with no missing text and no sideways overflow.

## Not tested
- A real phone, mobile data, Slow 4G, offline behaviour and frame rate on a mid-range phone.
- Lighthouse scores, a screen-reader pass and a full keyboard-only pass.
- Reduced motion (code paths exist; not observed).
- The Phase 2 and Phase 3 screens in Arabic and at tablet size by eye; the Costs, Crops and Soil tabs by eye at laptop size.
- Languages other than English and Arabic by a native reader.

## Known limits, said plainly
- Crop yields, prices, costs and temperature limits are illustrative catalogue values, labelled as such on screen. The crop library has 10 crops; a sourced library (FAO EcoCrop or national extension data) is the next step.
- Soil guidance is qualitative, by USDA texture class. It does not change any score: only a soil test can raise confidence.
- Planting windows come from monthly mean temperature only. They do not see frost nights, rain, day length or varieties.
- Scores are middle values across past seasons with a range. They are not a forecast and not a guarantee.
