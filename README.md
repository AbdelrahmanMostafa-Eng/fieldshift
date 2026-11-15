# FieldShift

A decision aid for farmers, built for the NASA Space Apps Challenge 2026 ("Field Shift: Adapting Farms with NASA Data"). Pick a place on the globe, compare three-year crop rotations for soil, water and income, and see what the data can and cannot tell you.

**Free edition:** zero API keys, zero paid services, no database. The assistant ("Atlas") is a rule-based helper, not an AI model.

## What is in it
- A 3D globe with NASA imagery (Blue Marble, daily VIIRS true colour), relief, satellite layers with legends (land surface temperature, vegetation greenness) and a date slider. A flat map takes over when the device cannot draw 3D.
- Rotation strategies scored from 24 years of NASA POWER monthly climate, each with a likely range, a confidence level, the evidence and what is not known.
- Seasons: the place's climate by month, warm, cool, wet and dry months by stated rules, frost nights from NASA POWER's monthly minimum temperature, planting windows by temperature, and a 7-day forecast.
- Costs and return in any currency: editable cost lines, break-even price and yield, a sensitivity table and a three-season total. Saved on the device only.
- A crop library of 52 crops with temperature, rain and crop-cycle limits from the FAO EcoCrop database, ranked by how well each fits the picked place.
- A soil texture explorer (the 12 USDA classes) and Atlas, which answers from the app's own data and declines dosing questions.
- English and Arabic (right-to-left), plus first-pass Spanish, French, Portuguese, Russian, Turkish, Indonesian, Swahili, Hindi, Bengali and Chinese. Installable on a phone's home screen.

## Run it
1. `npm install`
2. `npm run dev`, then open http://localhost:3000

No environment variables are needed. Checks: `npm run typecheck`, `npm test`, `npx eslint src`, `npm run build`.

## Data sources and credits
- NASA POWER (climate) and NASA GIBS / EOSDIS (imagery). NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites.
- Open-Meteo.com (place search and forecast, CC BY 4.0, free for non-commercial use).
- ExchangeRate-API open endpoint (currency rates).
- Mapzen terrain tiles hosted by AWS Open Data. Place names from Natural Earth (public domain).
- FAO EcoCrop database (crop temperature, rain and cycle limits), via the OpenCLIM/ecocrop redistribution. FAO terms of use apply. To refresh the extract: download `EcoCrop_DB.csv` into `data/raw/` (see `scripts/import-ecocrop.mjs`) and run `node scripts/import-ecocrop.mjs`.

What was tested live and what was not is in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Limits to know
- This is a decision aid. Scores are middle values across past seasons with a range, never a guarantee. Crop limits describe the species (FAO EcoCrop), not a variety. Yields, prices and costs are illustrative and exist for 10 starter crops only; the rest show "not available" until the farmer enters their own.
- Vercel Hobby and Open-Meteo's free tier are for non-commercial use. A hackathon demo is fine; a paid product needs a paid plan or another host.
- Translations other than English and Arabic are first-pass and need review by a native speaker. Atlas answers in English and Arabic only.

## For contributors
Project rules are in `CLAUDE.md`; the phased build plan is in `BUILD_PROMPT.md`.
