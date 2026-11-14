// Builds src/data/places.json, the small place-name extract used for globe labels.
// Input: Natural Earth 1:110m GeoJSON (public domain), downloaded from
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places.geojson
// Usage: node scripts/build-places.mjs <folder with the two .geojson files>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the folder that holds the two Natural Earth .geojson files");

// Order matters: index 0 is English, the fallback for every other language.
const LANGS = ["en", "ar", "es", "fr", "pt", "hi", "zh", "id", "ru", "tr", "bn"];
const read = (name) => JSON.parse(readFileSync(join(dir, name), "utf8")).features;
const round = (n) => Math.round(n * 100) / 100;
// Store "" when a translation is missing or equal to English, to keep the file small.
const names = (p, english) => LANGS.map((l, i) => {
  if (i === 0) return english;
  const v = p[`NAME_${l.toUpperCase()}`];
  return typeof v === "string" && v && v !== english ? v : "";
});

const countries = read("ne_110m_admin_0_countries.geojson")
  .map((f) => f.properties)
  .filter((p) => Number.isFinite(p.LABEL_X) && Number.isFinite(p.LABEL_Y))
  .sort((a, b) => a.LABELRANK - b.LABELRANK || b.POP_EST - a.POP_EST)
  .map((p) => [round(p.LABEL_X), round(p.LABEL_Y), p.MIN_LABEL, p.MAX_LABEL, p.LABELRANK, names(p, p.NAME || p.NAME_EN)]);

const cities = read("ne_110m_populated_places.geojson")
  .sort((a, b) => a.properties.SCALERANK - b.properties.SCALERANK || b.properties.POP_MAX - a.properties.POP_MAX)
  .map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return [round(lon), round(lat), p.MIN_ZOOM, p.SCALERANK, p.ADM0CAP ? 1 : 0, names(p, p.NAME || p.NAME_EN)];
  });

const out = {
  source: "Natural Earth 1:110m Cultural Vectors (Admin 0 Countries, Populated Places), naturalearthdata.com",
  url: "https://github.com/nvkelso/natural-earth-vector/tree/master/geojson",
  licence: "Public domain",
  note: "Label points, zoom ranges and names are copied from Natural Earth. Empty name = same as English.",
  langs: LANGS,
  // [lon, lat, minLabelZoom, maxLabelZoom, labelRank, names[]]
  countries,
  // [lon, lat, minZoom, scaleRank, isCapital, names[]]
  cities,
};

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "places.json");
writeFileSync(target, JSON.stringify(out) + "\n");
console.log(`${countries.length} countries, ${cities.length} cities -> ${target}`);
