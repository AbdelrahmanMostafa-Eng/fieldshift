// Builds src/data/ecocrop.json from the FAO EcoCrop database.
//
// 1. Download the full database (about 1.6 MB, 2,568 records) into data/raw/:
//      curl -o data/raw/EcoCrop_DB.csv https://raw.githubusercontent.com/OpenCLIM/ecocrop/main/EcoCrop_DB.csv
//    It is the FAO EcoCrop database as redistributed by the OpenCLIM project (UKCEH). data/raw/ is not committed.
// 2. node scripts/import-ecocrop.mjs
//
// Only the records listed in PICK are kept, and only the climate columns the app uses.
// The script stops with an error if a record is missing or a value is not a number, instead of guessing.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const SRC = join(root, "data/raw/EcoCrop_DB.csv");
const OUT = join(root, "src/data/ecocrop.json");

/** EcoPort code → the scientific name we expect for it, so a shifted row can never slip through. */
const PICK = {
  2114: "Triticum aestivum", 10582: "Triticum durum", 2175: "Zea mays", 1232: "Hordeum vulgare", 48747: "Sorghum bicolor",
  1574: "Oryza sativa", 8418: "Pennisetum glaucum", 5657: "Eleusine coracana ssp. coracana", 481: "Avena sativa",
  1929: "Secale cereale", 5746: "Eragrostis tef", 8280: "Panicum miliaceum", 2509: "Chenopodium quinoa",
  1150: "Glycine max", 2479: "Cicer arietinum", 2146: "Vicia faba", 7209: "Lens culinaris", 1668: "Phaseolus vulgaris",
  2153: "Vigna unguiculata", 1721: "Pisum sativum", 2199: "Arachis hypogaea", 2150: "Vigna radiata", 576: "Cajanus cajan",
  7431: "Lupinus albus", 10830: "Vigna subterranea", 549: "Brassica napus", 1191: "Helianthus annuus",
  1937: "Sesamum indicum", 2514: "Carthamus tinctorius", 7336: "Linum usitatissimum", 1971: "Solanum tuberosum",
  1265: "Ipomoea batatas", 1420: "Manihot esculenta", 48742: "Beta vulgaris var. saccharifera", 871: "Daucus carota",
  1997: "Spinacia oleracea", 1379: "Lycopersicon esculentum", 1965: "Solanum melongena", 618: "Capsicum annuum",
  817: "Cucumis sativus", 815: "Cucumis melo", 820: "Cucurbita moschata", 821: "Cucurbita pepo",
  554: "Brassica oleracea var. capitata", 553: "Brassica oleracea var. botrytis", 548: "Brassica juncea",
  364: "Allium cepa", 367: "Allium sativum", 1160: "Gossypium hirsutum", 289: "Abelmoschus esculentus",
  1428: "Medicago sativa", 10522: "Trifolium alexandrinum",
};

/** RFC 4180 style: commas inside double quotes, "" for a literal quote. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const num = (rec, col) => {
  const v = Number(rec[col]);
  if (rec[col] === "" || rec[col] === "NA" || !Number.isFinite(v)) throw new Error(`${rec.ScientificName}: ${col} is "${rec[col]}"`);
  return v;
};
const optional = (rec, col) => (rec[col] === "" || rec[col] === "NA" ? null : num(rec, col));

function main() {
  const [header, ...body] = parseCsv(readFileSync(SRC, "latin1"));
  const records = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  const out = Object.entries(PICK).map(([code, name]) => {
    const rec = records.find((r) => r.EcoPortCode === code);
    if (!rec) throw new Error(`EcoPort ${code} (${name}) not found`);
    if (rec.ScientificName.trim() !== name) throw new Error(`EcoPort ${code}: expected ${name}, found ${rec.ScientificName}`);
    const e = {
      code: Number(code), scientific: name,
      tMin: num(rec, "TMIN"), tOptLow: num(rec, "TOPMN"), tOptHigh: num(rec, "TOPMX"), tMax: num(rec, "TMAX"), killC: optional(rec, "KTMP"),
      rMin: num(rec, "RMIN"), rOptLow: num(rec, "ROPMN"), rOptHigh: num(rec, "ROPMX"), rMax: num(rec, "RMAX"),
      gMin: num(rec, "GMIN"), gMax: num(rec, "GMAX"),
    };
    if (!(e.tMin <= e.tOptLow && e.tOptLow <= e.tOptHigh && e.tOptHigh <= e.tMax)) throw new Error(`${name}: temperatures out of order`);
    if (!(e.rMin <= e.rOptLow && e.rOptLow <= e.rOptHigh && e.rOptHigh <= e.rMax)) throw new Error(`${name}: rainfall out of order`);
    if (!(e.gMin > 0 && e.gMin <= e.gMax)) throw new Error(`${name}: crop cycle missing`);
    return e;
  });
  const head = {
    source: "FAO EcoCrop database, as redistributed in EcoCrop_DB.csv by OpenCLIM/ecocrop (UKCEH), github.com/OpenCLIM/ecocrop. Columns: TMIN, TOPMN, TOPMX, TMAX, KTMP (°C); RMIN, ROPMN, ROPMX, RMAX (mm over the crop cycle); GMIN, GMAX (days).",
    importedAt: new Date().toISOString().slice(0, 10),
  };
  // One record per line, so a diff shows exactly which crop changed.
  const json = JSON.stringify(head, null, 1).replace(/\n}$/, `,\n "records": [\n${out.map((r) => "  " + JSON.stringify(r)).join(",\n")}\n ]\n}\n`);
  JSON.parse(json);
  writeFileSync(OUT, json);
  console.log(`wrote ${out.length} records to ${OUT}`);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
