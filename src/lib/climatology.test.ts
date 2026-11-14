import { describe, expect, it } from "vitest";
import { climatology } from "./climatology";
import type { ClimateSeries, Monthly } from "./rotation/types";

const series = (years: number[], t: Monthly, rain: Monthly): ClimateSeries => ({
  years, T2M: t, PRECTOTCORR: rain, ALLSKY_SFC_SW_DWN: years.map(() => Array(12).fill(15)),
  meta: { lat: 0, lon: 0, source: "test", fetchedAt: "2026-01-01" },
});
const flat = (n: number, v: number | null): Monthly => Array.from({ length: n }, () => Array(12).fill(v));

describe("climatology", () => {
  it("returns twelve months", () => {
    const c = climatology(series([2001, 2002], flat(2, 10), flat(2, 1)));
    expect(c).toHaveLength(12);
    expect(c.map((m) => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("turns mm per day into mm per month with the real month length, leap years included", () => {
    const c = climatology(series([2023, 2024], flat(2, 10), flat(2, 2)));
    expect(c[0].rainMm).toBeCloseTo(62); // January: 31 days x 2 mm
    expect(c[3].rainMm).toBeCloseTo(60); // April: 30 days x 2 mm
    // February: 28 days in 2023, 29 in 2024, so the middle value is between 56 and 58 mm
    expect(c[1].rainLow).toBeGreaterThanOrEqual(56);
    expect(c[1].rainHigh).toBeLessThanOrEqual(58);
    expect(c[1].rainMm).toBeCloseTo(57);
  });

  it("reports the middle year and the spread between cooler and warmer years", () => {
    const years = [2001, 2002, 2003, 2004, 2005];
    const t: Monthly = years.map((_, i) => Array(12).fill(10 + i)); // 10, 11, 12, 13, 14
    const c = climatology(series(years, t, flat(5, 1)));
    expect(c[6].tempC).toBeCloseTo(12);
    expect(c[6].tempLow).toBeCloseTo(10.4);
    expect(c[6].tempHigh).toBeCloseTo(13.6);
    expect(c[6].years).toBe(5);
  });

  it("skips missing values and reports null when a month has none", () => {
    const t: Monthly = [[null, 5, ...Array(10).fill(5)], [null, 7, ...Array(10).fill(7)]];
    const rain: Monthly = [[1, null, ...Array(10).fill(1)], [1, 3, ...Array(10).fill(1)]];
    const c = climatology(series([2001, 2002], t, rain));
    expect(c[0].tempC).toBeNull();
    expect(c[0].tempLow).toBeNull();
    expect(c[0].years).toBe(0);
    expect(c[1].tempC).toBeCloseTo(6);
    expect(c[1].rainMm).toBeCloseTo(84); // only 2002 has February rain: 28 days x 3 mm
    expect(c[1].years).toBe(1);
  });
});
