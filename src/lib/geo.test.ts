import { describe, expect, it } from "vitest";
import { easeOutCubic, latToMercatorY, mercatorYToLat, wrapLon, zoomForGlobeDiameter } from "./geo";

describe("geo", () => {
  it("wraps longitudes into -180..180", () => {
    expect(wrapLon(0)).toBe(0);
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(395)).toBe(35);
    expect(wrapLon(-725)).toBe(-5);
    expect(wrapLon(180)).toBe(180);
    expect(wrapLon(-180)).toBe(-180);
  });
  it("converts between latitude and Web Mercator height both ways", () => {
    expect(mercatorYToLat(0.5)).toBeCloseTo(0, 9);
    expect(mercatorYToLat(0)).toBeCloseTo(85.0511, 3);
    expect(mercatorYToLat(1)).toBeCloseTo(-85.0511, 3);
    for (const lat of [-60, -23.4, 0, 24.69, 51.5, 70]) expect(mercatorYToLat(latToMercatorY(lat))).toBeCloseTo(lat, 6);
  });
  it("sizes the globe: doubling the diameter adds one zoom level", () => {
    const z = zoomForGlobeDiameter(400, 18);
    expect(zoomForGlobeDiameter(800, 18) - z).toBeCloseTo(1, 9);
    // 512 px world at zoom 0 has a diameter of 512/π px at the equator
    expect(zoomForGlobeDiameter(512 / Math.PI, 0)).toBeCloseTo(0, 9);
  });
  it("eases out and stays inside 0..1", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
