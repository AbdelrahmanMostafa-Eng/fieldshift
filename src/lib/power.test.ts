import { describe, expect, it } from "vitest";
import { buildPowerMonthlyUrl, cellKey, parsePowerMonthly } from "./power";

const fixture = {
  properties: {
    parameter: {
      T2M: { "202001": 10.5, "202002": -999, "202013": 18, "202101": 11 },
      PRECTOTCORR: { "202001": 1.2, "202101": 0.8 },
      ALLSKY_SFC_SW_DWN: { "202001": 9.1 },
    },
  },
};

describe("parsePowerMonthly", () => {
  it("builds year x month arrays, maps -999 to null, ignores month 13", () => {
    const s = parsePowerMonthly(fixture, { lat: 24.7, lon: 46.7 });
    expect(s.years).toEqual([2020, 2021]);
    expect(s.T2M[0][0]).toBe(10.5);
    expect(s.T2M[0][1]).toBeNull();
    expect(s.T2M[0]).toHaveLength(12);
    expect(s.PRECTOTCORR[1][0]).toBe(0.8);
    expect(s.PRECTOTCORR[1][5]).toBeNull();
  });
  it("throws a clear error on an unexpected shape", () => {
    expect(() => parsePowerMonthly({}, { lat: 0, lon: 0 })).toThrow(/T2M missing/);
  });
});

describe("urls and cache keys", () => {
  it("builds the monthly point URL", () => {
    const u = new URL(buildPowerMonthlyUrl({ lat: 24.7136, lon: 46.6753, startYear: 2001, endYear: 2024 }));
    expect(u.pathname).toBe("/api/temporal/monthly/point");
    expect(u.searchParams.get("community")).toBe("AG");
    expect(u.searchParams.get("parameters")).toBe("T2M,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN");
    expect(u.searchParams.get("latitude")).toBe("24.7136");
  });
  it("rounds nearby points into one cache cell", () => {
    expect(cellKey(24.71, 46.66, 2001, 2024).key).toBe(cellKey(24.8, 46.7, 2001, 2024).key);
  });
});

describe("T2M_MIN (monthly lowest air temperature)", () => {
  it("is requested and parsed with the same -999 handling", () => {
    expect(new URL(buildPowerMonthlyUrl({ lat: 1, lon: 2, startYear: 2001, endYear: 2024 })).searchParams.get("parameters")).toContain("T2M_MIN");
    const s = parsePowerMonthly({ properties: { parameter: { ...fixture.properties.parameter, T2M_MIN: { "202001": -0.06, "202002": -999 } } } }, { lat: 24.7, lon: 46.7 });
    expect(s.T2M_MIN?.[0][0]).toBe(-0.06);
    expect(s.T2M_MIN?.[0][1]).toBeNull();
  });
  it("is left out when the response has none", () => {
    expect(parsePowerMonthly(fixture, { lat: 24.7, lon: 46.7 }).T2M_MIN).toBeUndefined();
  });
});
