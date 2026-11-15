import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { parseCsv } from "../../scripts/import-ecocrop.mjs";
import { CROPS, cropName } from "./crops";
import ecocrop from "./ecocrop.json";

describe("crop library", () => {
  it("has at least 40 crops with unique ids", () => {
    expect(CROPS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CROPS.map((c) => c.id)).size).toBe(CROPS.length);
  });

  it.each(CROPS.map((c) => [c.id, c] as const))("%s: agronomy is the EcoCrop record it names", (_, c) => {
    const rec = ecocrop.records.find((r) => r.code === c.ecoPort)!;
    expect(rec, `EcoPort ${c.ecoPort}`).toBeDefined();
    expect(c.scientific).toBe(rec.scientific);
    expect([c.tMin, c.tOptLow, c.tOptHigh, c.tMax]).toEqual([rec.tMin, rec.tOptLow, rec.tOptHigh, rec.tMax]);
    expect(c.waterNeedMm).toBe(rec.rOptLow);
    expect(c.cycleDays).toEqual([rec.gMin, rec.gMax]);
    expect(c.seasonDays).toBeGreaterThanOrEqual(rec.gMin);
    expect(c.seasonDays).toBeLessThanOrEqual(rec.gMax);
    expect(c.source).toContain(`EcoPort ${c.ecoPort}`);
  });

  it("keeps temperature and rain limits in order", () => {
    for (const c of CROPS) {
      expect(c.tMin <= c.tOptLow && c.tOptLow <= c.tOptHigh && c.tOptHigh <= c.tMax, c.id).toBe(true);
      expect(c.rainMm.min <= c.rainMm.optLow && c.rainMm.optLow <= c.rainMm.optHigh && c.rainMm.optHigh <= c.rainMm.max, c.id).toBe(true);
    }
  });

  it("has economics only with a stated source, and never half a set", () => {
    for (const c of CROPS) {
      const vals = [c.yieldTHa, c.priceUsdPerT, c.costUsdHa];
      if (vals.every((v) => v === null)) expect(c.economicsSource, c.id).toBeNull();
      else {
        expect(vals.every((v) => typeof v === "number" && v > 0), c.id).toBe(true);
        expect(c.economicsSource, c.id).toMatch(/ILLUSTRATIVE/);
      }
    }
  });

  it("only legumes are flagged as nitrogen fixing", () => {
    for (const c of CROPS.filter((x) => x.nFixing)) expect(["legume", "forage"], c.id).toContain(c.family);
  });

  it("has a name in every app language", () => {
    for (const c of CROPS) {
      for (const l of LOCALES) expect(cropName(c.id, l).trim().length, `${c.id}:${l}`).toBeGreaterThan(0);
      expect(cropName(c.id, "ar"), c.id).toMatch(/[؀-ۿ]/);
    }
  });
});

describe("EcoCrop import", () => {
  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,b,c\n1,"x, y","say ""hi"""\r\n2,,z\n')).toEqual([["a", "b", "c"], ["1", "x, y", 'say "hi"'], ["2", "", "z"]]);
  });
  it("names its source", () => {
    expect(ecocrop.source).toMatch(/FAO EcoCrop/);
  });
});
