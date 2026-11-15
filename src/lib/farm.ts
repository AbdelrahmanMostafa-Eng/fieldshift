import { AREA_UNITS, SEASON_RULES, type AreaUnit } from "@/data/reference";
import type { MonthStat } from "@/lib/climatology";
import { economics, type EconomicsResult } from "@/lib/roi";
import { monthsFor } from "@/lib/rotation/engine";
import type { ClimateSeries, Crop } from "@/lib/rotation/types";

// ---- Costs and return ----------------------------------------------------------------------------

export const COST_LINES = ["seed", "fertiliser", "protection", "labour", "machinery", "water", "rent", "other"] as const;
export type CostLine = (typeof COST_LINES)[number];

/** One crop's budget. Money is kept in US dollars per hectare; the screen converts for display. */
export interface CropBudget { cropId: string; yieldTHa: number; priceUsdPerT: number; costs: Record<CostLine, number> }

/**
 * Starting budget from the catalogue. The catalogue has one total cost per crop and no split,
 * so the whole amount starts under "other" instead of inventing a breakdown.
 * A crop without catalogue economics starts blank (NaN shows as an empty box), never as zero.
 */
export function defaultBudget(crop: Crop): CropBudget {
  const costs = Object.fromEntries(COST_LINES.map((k) => [k, 0])) as Record<CostLine, number>;
  costs.other = crop.costUsdHa ?? Number.NaN;
  return { cropId: crop.id, yieldTHa: crop.yieldTHa ?? Number.NaN, priceUsdPerT: crop.priceUsdPerT ?? Number.NaN, costs };
}

const num = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
export const totalCostUsdHa = (b: CropBudget) => COST_LINES.reduce((s, k) => s + num(b.costs[k]), 0);
/** A budget can be summed only once it has a yield and a price. Until then the screen says "not available". */
export const budgetReady = (b: CropBudget) => num(b.yieldTHa) > 0 && num(b.priceUsdPerT) > 0;

export function budgetResult(b: CropBudget, areaHa = 1): EconomicsResult {
  return economics({ yieldTHa: num(b.yieldTHa), priceUsdPerT: num(b.priceUsdPerT), costUsdHa: totalCostUsdHa(b), areaHa: num(areaHa) });
}

/** Net return when yield and price each move by the given shares. Rows are yield changes, columns are price changes. */
export function sensitivity(b: CropBudget, areaHa = 1, steps: number[] = [-0.2, 0, 0.2]): number[][] {
  return steps.map((dy) => steps.map((dp) => budgetResult({ ...b, yieldTHa: num(b.yieldTHa) * (1 + dy), priceUsdPerT: num(b.priceUsdPerT) * (1 + dp) }, areaHa).net));
}

/** Totals over several seasons, one budget per season. */
export function rollup(budgets: CropBudget[], areaHa = 1): Pick<EconomicsResult, "revenue" | "totalCost" | "net" | "roiPct"> {
  const parts = budgets.map((b) => budgetResult(b, areaHa));
  const revenue = parts.reduce((s, p) => s + p.revenue, 0), totalCost = parts.reduce((s, p) => s + p.totalCost, 0);
  return { revenue, totalCost, net: revenue - totalCost, roiPct: totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : null };
}

export const areaUnit = (id: string): AreaUnit => AREA_UNITS.find((u) => u.id === id) ?? AREA_UNITS[0];
export const toHectares = (amount: number, unitId: string) => num(amount) * areaUnit(unitId).ha;

// ---- Seasons -------------------------------------------------------------------------------------

export interface Seasons { warm: number[]; cool: number[]; wet: number[]; dry: number[]; yearMeanC: number | null }

/** Sorts the twelve months into warm, cool, wet and dry using the stated rules in src/data/reference.ts. */
export function seasons(stats: MonthStat[]): Seasons {
  const temps = stats.map((s) => s.tempC).filter((v): v is number => v !== null);
  const yearMeanC = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const d = SEASON_RULES.tempDeltaC.value, wetMm = SEASON_RULES.wetMonthMm.value;
  const out: Seasons = { warm: [], cool: [], wet: [], dry: [], yearMeanC };
  for (const s of stats) {
    if (yearMeanC !== null && s.tempC !== null) {
      if (s.tempC >= yearMeanC + d) out.warm.push(s.month);
      else if (s.tempC <= yearMeanC - d) out.cool.push(s.month);
    }
    if (s.rainMm !== null) (s.rainMm >= wetMm ? out.wet : out.dry).push(s.month);
  }
  return out;
}

export interface FrostMonth { month: number; years: number; of: number }

/**
 * Months in which the coldest night fell below the frost threshold, and in how many of the years with data.
 * Uses NASA POWER T2M_MIN (air at 2 m). Ground frost can happen on nights a little above it. Empty when the series has no T2M_MIN.
 */
export function frostMonths(series: ClimateSeries): FrostMonth[] {
  const min = series.T2M_MIN;
  if (!min) return [];
  const limit = SEASON_RULES.frostC.value;
  const out: FrostMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const vals = min.map((row) => row?.[m]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const years = vals.filter((v) => v < limit).length;
    if (years > 0) out.push({ month: m, years, of: vals.length });
  }
  return out;
}

export type Fit = "good" | "possible" | "no" | "unknown";

/**
 * For each possible planting month: does the crop's whole season stay inside its temperature limits?
 * "good" = every month inside the best range, "possible" = inside the tolerated range, "no" = some month outside it.
 * Derived from monthly mean temperature only. It knows nothing about frost nights, rain, day length or varieties.
 */
export function plantingWindow(crop: Crop, stats: MonthStat[]): Fit[] {
  return Array.from({ length: 12 }, (_, start) => {
    const temps = monthsFor(start, crop.seasonDays).map((m) => stats[m]?.tempC ?? null);
    if (temps.some((t) => t === null)) return "unknown";
    const t = temps as number[];
    if (t.every((v) => v >= crop.tOptLow && v <= crop.tOptHigh)) return "good";
    if (t.every((v) => v >= crop.tMin && v <= crop.tMax)) return "possible";
    return "no";
  });
}

// ---- Soil texture --------------------------------------------------------------------------------

/**
 * USDA soil texture class from sand and clay percent (silt is the rest).
 * Limits follow the USDA Soil Survey Manual, chapter 3. Returns an id from TEXTURE_CLASSES, or null for impossible input.
 */
export function textureClass(sand: number, clay: number): string | null {
  const silt = 100 - sand - clay;
  if (sand < 0 || clay < 0 || silt < -1e-9) return null;
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 2 * clay < 30) return "loamySand";
  if ((clay >= 7 && clay < 20 && sand > 52) || (clay < 7 && silt < 50)) return "sandyLoam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "siltLoam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandyClayLoam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clayLoam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "siltyClayLoam";
  if (clay >= 35 && sand > 45) return "sandyClay";
  if (clay >= 40 && silt >= 40) return "siltyClay";
  return "clay";
}
