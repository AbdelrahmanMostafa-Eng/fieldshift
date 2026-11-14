import type { Crop } from "@/lib/rotation/types";

const ILLUSTRATIVE =
  "ILLUSTRATIVE starter value for the demo. Replace with FAO EcoCrop / national extension data before showing real advice.";

export const CROPS: Crop[] = [
  { id: "wheat", name: "Wheat", family: "cereal", nFixing: false, residue: "high", waterNeedMm: 450, tMin: 3, tOptLow: 10, tOptHigh: 22, tMax: 32, seasonDays: 150, yieldTHa: 4.0, priceUsdPerT: 260, costUsdHa: 650, aliases: ["wheat", "قمح"], source: ILLUSTRATIVE },
  { id: "maize", name: "Maize", family: "cereal", nFixing: false, residue: "high", waterNeedMm: 600, tMin: 10, tOptLow: 18, tOptHigh: 30, tMax: 38, seasonDays: 140, yieldTHa: 6.5, priceUsdPerT: 220, costUsdHa: 900, aliases: ["maize", "corn", "ذرة شامية", "ذرة"], source: ILLUSTRATIVE },
  { id: "barley", name: "Barley", family: "cereal", nFixing: false, residue: "medium", waterNeedMm: 380, tMin: 2, tOptLow: 9, tOptHigh: 20, tMax: 30, seasonDays: 120, yieldTHa: 3.6, priceUsdPerT: 230, costUsdHa: 560, aliases: ["barley", "شعير"], source: ILLUSTRATIVE },
  { id: "soy", name: "Soybean", family: "legume", nFixing: true, residue: "medium", waterNeedMm: 520, tMin: 10, tOptLow: 20, tOptHigh: 30, tMax: 36, seasonDays: 130, yieldTHa: 2.8, priceUsdPerT: 480, costUsdHa: 620, aliases: ["soy", "soya", "soybean", "soybeans", "فول الصويا", "صويا"], source: ILLUSTRATIVE },
  { id: "chickpea", name: "Chickpea", family: "legume", nFixing: true, residue: "low", waterNeedMm: 300, tMin: 5, tOptLow: 15, tOptHigh: 26, tMax: 34, seasonDays: 110, yieldTHa: 1.6, priceUsdPerT: 650, costUsdHa: 450, aliases: ["chickpea", "chickpeas", "garbanzo", "حمص"], source: ILLUSTRATIVE },
  { id: "faba", name: "Faba bean", family: "legume", nFixing: true, residue: "medium", waterNeedMm: 350, tMin: 2, tOptLow: 10, tOptHigh: 22, tMax: 30, seasonDays: 140, yieldTHa: 2.4, priceUsdPerT: 420, costUsdHa: 500, aliases: ["faba", "faba bean", "broad bean", "فول", "فول بلدي"], source: ILLUSTRATIVE },
  { id: "canola", name: "Canola", family: "oilseed", nFixing: false, residue: "medium", waterNeedMm: 400, tMin: 3, tOptLow: 10, tOptHigh: 22, tMax: 30, seasonDays: 160, yieldTHa: 2.4, priceUsdPerT: 520, costUsdHa: 640, aliases: ["canola", "rapeseed", "كانولا", "لفت زيتي"], source: ILLUSTRATIVE },
  { id: "potato", name: "Potato", family: "solanum", nFixing: false, residue: "low", waterNeedMm: 500, tMin: 4, tOptLow: 12, tOptHigh: 22, tMax: 30, seasonDays: 110, yieldTHa: 30, priceUsdPerT: 180, costUsdHa: 3200, aliases: ["potato", "potatoes", "بطاطس", "بطاطا"], source: ILLUSTRATIVE },
  { id: "sorghum", name: "Sorghum", family: "cereal", nFixing: false, residue: "high", waterNeedMm: 380, tMin: 12, tOptLow: 22, tOptHigh: 34, tMax: 42, seasonDays: 120, yieldTHa: 3.0, priceUsdPerT: 210, costUsdHa: 480, aliases: ["sorghum", "ذرة رفيعة", "سورغم"], source: ILLUSTRATIVE },
  { id: "alfalfa", name: "Alfalfa (forage)", family: "forage", nFixing: true, residue: "high", waterNeedMm: 700, tMin: 5, tOptLow: 15, tOptHigh: 28, tMax: 36, seasonDays: 200, yieldTHa: 9, priceUsdPerT: 190, costUsdHa: 800, aliases: ["alfalfa", "lucerne", "برسيم حجازي", "برسيم", "فصة"], source: ILLUSTRATIVE },
];

export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]));

const ARABIC = /[\u0600-\u06FF]/;
/** The crop's name for the page language. Arabic uses the first Arabic alias; other languages fall back to English for now. */
export function cropName(id: string, locale: string): string {
  const c = CROP_BY_ID.get(id);
  if (!c) return id;
  if (locale === "ar") return c.aliases?.find((a) => ARABIC.test(a)) ?? c.name;
  return c.name;
}
