import { describe, expect, it } from "vitest";
import { CROPS } from "@/data/crops";
import { AREA_UNITS, TEXTURE_CLASSES } from "@/data/reference";
import type { MonthStat } from "./climatology";
import { budgetReady, budgetResult, defaultBudget, frostMonths, plantingWindow, rollup, seasons, sensitivity, textureClass, toHectares, totalCostUsdHa } from "./farm";

const wheat = CROPS.find((c) => c.id === "wheat")!;
const month = (m: number, tempC: number | null, rainMm: number | null): MonthStat =>
  ({ month: m, tempC, tempLow: tempC, tempHigh: tempC, rainMm, rainLow: rainMm, rainHigh: rainMm, years: 24 });

describe("budgets", () => {
  it("starts from the catalogue total without inventing a breakdown", () => {
    const b = defaultBudget(wheat);
    expect(totalCostUsdHa(b)).toBe(wheat.costUsdHa);
    expect(b.costs.other).toBe(wheat.costUsdHa);
    expect(b.costs.seed).toBe(0);
  });
  it("computes cost, revenue, net, ROI and break-even for an area", () => {
    const b = { ...defaultBudget(wheat), yieldTHa: 4, priceUsdPerT: 250 };
    b.costs = { ...b.costs, other: 0, seed: 100, labour: 400 };
    const r = budgetResult(b, 2);
    expect(r.totalCost).toBe(1000);
    expect(r.revenue).toBe(2000);
    expect(r.net).toBe(1000);
    expect(r.roiPct).toBeCloseTo(100);
    expect(r.breakEvenPrice).toBeCloseTo(125);
    expect(r.breakEvenYield).toBeCloseTo(2);
  });
  it("treats blank or negative entries as zero and reports no ROI without cost", () => {
    const b = defaultBudget(wheat);
    b.costs = { ...b.costs, other: Number.NaN, seed: -5 };
    expect(totalCostUsdHa(b)).toBe(0);
    expect(budgetResult(b).roiPct).toBeNull();
  });
  it("builds a 3 by 3 sensitivity grid with the unchanged case in the middle", () => {
    const b = defaultBudget(wheat);
    const g = sensitivity(b, 1);
    expect(g).toHaveLength(3);
    expect(g[1][1]).toBeCloseTo(budgetResult(b).net);
    expect(g[0][0]).toBeLessThan(g[1][1]);
    expect(g[2][2]).toBeGreaterThan(g[1][1]);
  });
  it("adds seasons up", () => {
    const b = defaultBudget(wheat), one = budgetResult(b, 3);
    const r = rollup([b, b, b], 3);
    expect(r.net).toBeCloseTo(one.net * 3);
    expect(r.totalCost).toBeCloseTo(one.totalCost * 3);
  });
  it("converts area units, each with a source", () => {
    expect(toHectares(10, "ha")).toBe(10);
    expect(toHectares(1, "acre")).toBeCloseTo(0.4047, 4);
    expect(toHectares(10, "feddan")).toBeCloseTo(4.2);
    for (const u of AREA_UNITS) expect(u.source.length).toBeGreaterThan(10);
  });
});

describe("seasons", () => {
  const stats = Array.from({ length: 12 }, (_, m) => month(m, 15 + 10 * Math.sin(((m - 3) / 12) * 2 * Math.PI), m < 3 ? 80 : 10));
  it("sorts months into warm, cool, wet and dry by the stated rules", () => {
    const s = seasons(stats);
    expect(s.yearMeanC).toBeCloseTo(15);
    expect(s.warm).toContain(6);
    expect(s.cool).toContain(0);
    expect(s.wet).toEqual([0, 1, 2]);
    expect(s.dry).toHaveLength(9);
  });
  it("copes with missing months", () => {
    const s = seasons([month(0, null, null), month(1, 10, 70)]);
    expect(s.yearMeanC).toBeCloseTo(10);
    expect(s.wet).toEqual([1]);
    expect(s.warm).toEqual([]);
  });
});

describe("plantingWindow", () => {
  it("marks months by the crop's temperature limits over its whole season", () => {
    const mild = Array.from({ length: 12 }, (_, m) => month(m, 16, 50));
    expect(plantingWindow(wheat, mild).every((f) => f === "good")).toBe(true);
    const hot = Array.from({ length: 12 }, (_, m) => month(m, 40, 50));
    expect(plantingWindow(wheat, hot).every((f) => f === "no")).toBe(true);
    const warmish = Array.from({ length: 12 }, (_, m) => month(m, 27, 50));
    expect(plantingWindow(wheat, warmish).every((f) => f === "possible")).toBe(true);
  });
  it("says unknown when a month of the season has no temperature", () => {
    const gap = Array.from({ length: 12 }, (_, m) => month(m, m === 5 ? null : 16, 50));
    const w = plantingWindow(wheat, gap);
    expect(w[5]).toBe("unknown");
    expect(w[7]).toBe("good");
  });
});

describe("textureClass", () => {
  it("names the USDA class for typical mixes", () => {
    expect(textureClass(92, 4)).toBe("sand");
    expect(textureClass(82, 6)).toBe("loamySand");
    expect(textureClass(65, 10)).toBe("sandyLoam");
    expect(textureClass(40, 20)).toBe("loam");
    expect(textureClass(20, 15)).toBe("siltLoam");
    expect(textureClass(5, 5)).toBe("silt");
    expect(textureClass(60, 27)).toBe("sandyClayLoam");
    expect(textureClass(32, 34)).toBe("clayLoam");
    expect(textureClass(10, 34)).toBe("siltyClayLoam");
    expect(textureClass(52, 42)).toBe("sandyClay");
    expect(textureClass(6, 47)).toBe("siltyClay");
    expect(textureClass(20, 60)).toBe("clay");
  });
  it("rejects impossible mixes and always returns a known class otherwise", () => {
    expect(textureClass(70, 40)).toBeNull();
    const ids = new Set(TEXTURE_CLASSES.map((c) => c.id));
    for (let clay = 0; clay <= 100; clay += 5) for (let sand = 0; sand <= 100 - clay; sand += 5) expect(ids.has(textureClass(sand, clay) as string)).toBe(true);
  });
});

describe("crops without catalogue economics", () => {
  it("start blank, never as zero, and are not summed until a yield and price are entered", () => {
    const okra = CROPS.find((c) => c.id === "okra")!;
    const b = defaultBudget(okra);
    expect(Number.isNaN(b.yieldTHa) && Number.isNaN(b.priceUsdPerT)).toBe(true);
    expect(budgetReady(b)).toBe(false);
    expect(budgetReady({ ...b, yieldTHa: 10, priceUsdPerT: 400 })).toBe(true);
    expect(budgetReady(defaultBudget(CROPS.find((c) => c.id === "wheat")!))).toBe(true);
  });
});

describe("frostMonths", () => {
  const series = (min: (number | null)[][] | undefined) => ({
    years: [2001, 2002, 2003], T2M: [[], [], []], PRECTOTCORR: [[], [], []], ALLSKY_SFC_SW_DWN: [[], [], []],
    ...(min ? { T2M_MIN: min } : {}), meta: { lat: 0, lon: 0, source: "test", fetchedAt: "" },
  });
  const row = (jan: number | null, feb: number | null) => [jan, feb, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  it("counts the years whose coldest night in a month fell below 0 °C", () => {
    expect(frostMonths(series([row(-2, 1), row(-0.1, -3), row(null, 0)]))).toEqual([
      { month: 0, years: 2, of: 2 },
      { month: 1, years: 1, of: 3 },
    ]);
  });
  it("is empty without T2M_MIN, and when no night went below zero", () => {
    expect(frostMonths(series(undefined))).toEqual([]);
    expect(frostMonths(series([row(0, 1), row(2, 3), row(4, 5)]))).toEqual([]);
  });
});
