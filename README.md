# FieldShift

A decision aid for farmers, built for the NASA Space Apps Challenge 2026 ("Field Shift: Adapting Farms with NASA Data"). Pick a place on the globe, compare crop rotations of one to five seasons for soil, water and income, and see what the data can and cannot tell you.

**Free edition:** zero API keys, zero paid services, no database. The assistant ("Atlas") is a rule-based helper, not an AI model.

## What is in it
- A 3D globe with NASA imagery (Blue Marble, daily VIIRS true colour), relief, and seven NASA layers with legends: land surface temperature, vegetation greenness, air temperature, wind speed, relative humidity, rain rate and root-zone soil water. A date slider, and a button that brings back the whole globe. A flat map takes over when the device cannot draw 3D.
- Suitability zones for any crop: green, yellow and red squares on NASA POWER's native grid around the place, scored with the same FAO EcoCrop rule as the crop library. Open water is left out.
- Rotation strategies scored from 24 years of NASA POWER monthly climate, each with a likely range, a confidence level, the evidence and what is not known. Past crops and the plan can each have up to five seasons; priorities are Low, Medium or High.
- Crop suggestions for the picked place, best fit first, with one-tap "add to plan" and "show zones".
- Seasons: current conditions (Open-Meteo, refreshed every 15 minutes), the place's climate and sunlight by month, warm, cool, wet and dry months by stated rules, frost nights from NASA POWER's monthly minimum temperature, planting windows by temperature, and a 7-day forecast.
- Costs and return in 166 currencies (searchable, alphabetical): editable cost lines, break-even price and yield, a sensitivity table and a total for all planned seasons. Saved on the device only.
- A crop library of 81 crops, each with its own drawn icon, temperature, rain, crop-cycle and soil-texture limits from the FAO EcoCrop database, ranked by how well each fits the picked place, plus feeding principles (no product names or doses).
- A soil texture explorer (the 12 USDA classes) with the crops that do best on each, and Atlas, which answers from the app's own data and declines dosing questions.
- 18 languages: English and Arabic, plus first-pass Spanish, French, Portuguese, German, Russian, Ukrainian, Turkish, Persian, Urdu, Hindi, Bengali, Indonesian, Vietnamese, Thai, Swahili and Chinese. Arabic, Persian and Urdu run right to left. Installable on a phone's home screen.

## Run it
1. `npm install`
2. `npm run dev`, then open http://localhost:3000

No environment variables are needed. Checks: `npm run typecheck`, `npm test`, `npx eslint src`, `npm run build`.

## Data sources and credits
- NASA POWER (climate) and NASA GIBS / EOSDIS (imagery). NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites.
- Open-Meteo.com (place search, forecast and current conditions, CC BY 4.0, free for non-commercial use). The Google Weather API is not used: it needs a key and billing, and this edition runs with none.
- ExchangeRate-API open endpoint (currency rates).
- Mapzen terrain tiles hosted by AWS Open Data. Place names from Natural Earth (public domain).
- Feeding principles: FAO (2006) Plant nutrition for food security (Fertilizer and Plant Nutrition Bulletin 16) and IPNI (2012) 4R Plant Nutrition Manual. Principles only, no rates.
- FAO EcoCrop database (crop temperature, rain, cycle and soil-texture limits), via the OpenCLIM/ecocrop redistribution. FAO terms of use apply. To refresh the extract: download `EcoCrop_DB.csv` into `data/raw/` (see `scripts/import-ecocrop.mjs`) and run `node scripts/import-ecocrop.mjs`.

What was tested live and what was not is in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Limits to know
- This is a decision aid. Scores are middle values across past seasons with a range, never a guarantee. Crop limits describe the species (FAO EcoCrop), not a variety. Yields, prices and costs are illustrative and exist for 10 starter crops only; the rest show "not available" until the farmer enters their own.
- Vercel Hobby and Open-Meteo's free tier are for non-commercial use. A hackathon demo is fine; a paid product needs a paid plan or another host.
- Translations other than English and Arabic are first-pass and need review by a native speaker. Atlas answers in English and Arabic only.

## For contributors
Project rules are in `CLAUDE.md`; the phased build plan is in `BUILD_PROMPT.md`.
