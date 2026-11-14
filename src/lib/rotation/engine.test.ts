import { describe, expect, it } from "vitest";
import { CROPS } from "@/data/crops";
import { recommend, percentile, soilScore, monthsFor } from "./engine";
import type { ClimateSeries, EngineInput } from "./types";

const years = Array.from({ length: 24 }, (_, i) => 2001 + i);
const mk = (f: (yi: number, m: number) => number) => years.map((_, yi) => Array.from({ length: 12 }, (_, m) => f(yi, m)));
const climate = (rain: number): ClimateSeries => ({
  years,
  T2M: mk((yi, m) => 14 + 8 * Math.sin(((m - 3) / 12) * 2 * Math.PI) + (yi % 3) * 0.5),
  PRECTOTCORR: mk((yi, m) => rain * (1 + 0.3 * Math.sin(yi + m))),
  ALLSKY_SFC_SW_DWN: mk(() => 15),
  meta: { lat: 0, lon: 0, source: "test", fetchedAt: "2026-01-01" },
});
const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  climate: climate(3), catalog: CROPS, history: ["wheat", "wheat"], current: ["wheat", "wheat", "wheat"],
  startMonth: 9, irrigated: false, hasLocalSoil: false,
  weights: { soil: 1, water: 1, climate: 1, economics: 1, risk: 1 }, ...over,
});
const byId = (id: string) => CROPS.find((c) => c.id === id)!;

describe("soilScore", () => {
  it("scores a legume rotation above a wheat monoculture", () => {
    const hist = [byId("wheat"), byId("wheat")];
    expect(soilScore([byId("chickpea"), byId("wheat"), byId("faba")], hist))
      .toBeGreaterThan(soilScore([byId("wheat"), byId("wheat"), byId("wheat")], hist));
  });
});

describe("recommend", () => {
  const out = recommend(base());
  it("returns at least three distinct strategies including the current plan", () => {
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out[0].id).toBe("current");
    expect(new Set(out.map((s) => s.sequence.join(">"))).size).toBe(out.length);
  });
  it("orders each band p10 <= p50 <= p90 and keeps scores in 0..100", () => {
    for (const s of out) {
      expect(s.band.p10).toBeLessThanOrEqual(s.band.p50);
      expect(s.band.p50).toBeLessThanOrEqual(s.band.p90);
      for (const v of Object.values(s.scores)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
  it("beats the monoculture baseline on soil in the soil-builder strategy", () => {
    const soil = out.find((s) => s.id === "soil")!;
    expect(soil.scores.soil).toBeGreaterThan(out[0].scores.soil);
  });
  it("never reports high confidence without local soil data", () => {
    expect(out.every((s) => s.confidence !== "high")).toBe(true);
  });
  it("fills the fields the challenge asks for", () => {
    for (const s of out) { expect(s.why.length).toBeGreaterThan(0); expect(s.evidence.length).toBeGreaterThan(0); expect(s.gaps.length).toBeGreaterThan(0); expect(s.risks.length).toBeGreaterThan(0); }
  });
  it("skips the current plan when it is incomplete", () => {
    expect(recommend(base({ current: [] })).some((s) => s.id === "current")).toBe(false);
  });
  it("rewards the water-saver strategy in a dry climate", () => {
    const dry = recommend(base({ climate: climate(0.8) }));
    const w = dry.find((s) => s.id === "water")!;
    expect(w.scores.water).toBeGreaterThanOrEqual(dry[0].scores.water);
  });
});

describe("helpers", () => {
  it("interpolates percentiles", () => { expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3); expect(percentile([0, 10], 0.1)).toBeCloseTo(1); });
  it("wraps seasons across the year end", () => { expect(monthsFor(10, 120)).toEqual([10, 11, 0, 1]); });
});
