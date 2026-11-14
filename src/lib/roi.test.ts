import { describe, expect, it } from "vitest";
import { economics, formatMoney, fromUsd } from "./roi";

describe("economics", () => {
  it("computes revenue, net, ROI and break-evens", () => {
    const r = economics({ yieldTHa: 4, priceUsdPerT: 200, costUsdHa: 500 });
    expect(r.revenue).toBe(800);
    expect(r.net).toBe(300);
    expect(r.roiPct).toBeCloseTo(60);
    expect(r.breakEvenPrice).toBeCloseTo(125);
    expect(r.breakEvenYield).toBeCloseTo(2.5);
  });
  it("scales with area", () => {
    const r = economics({ yieldTHa: 4, priceUsdPerT: 200, costUsdHa: 500, areaHa: 10 });
    expect(r.net).toBe(3000);
  });
  it("does not divide by zero", () => {
    const r = economics({ yieldTHa: 0, priceUsdPerT: 0, costUsdHa: 0 });
    expect(r.roiPct).toBeNull();
    expect(r.breakEvenPrice).toBeNull();
    expect(r.breakEvenYield).toBeNull();
  });
});

describe("currency", () => {
  it("converts from USD using a rates table and returns null for unknown codes", () => {
    expect(fromUsd(100, "EUR", { EUR: 0.9 })).toBeCloseTo(90);
    expect(fromUsd(100, "USD", {})).toBe(100);
    expect(fromUsd(100, "XXX", { EUR: 0.9 })).toBeNull();
  });
  it("formats with Intl", () => {
    expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,235");
  });
});
