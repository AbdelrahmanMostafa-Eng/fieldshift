import { describe, expect, it } from "vitest";
import { BASE_LAYER, BLUE_MARBLE, OVERLAYS, gibsDate, kelvinToCelsius, legendGradient, tileUrl, timeFor } from "./gibs";

describe("gibs", () => {
  it("builds a WMTS REST template with z/y/x placeholders", () => {
    expect(tileUrl(BASE_LAYER, "2026-11-13")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-11-13/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    );
  });
  it("leaves the date out for the static Blue Marble layer", () => {
    expect(tileUrl(BLUE_MARBLE, "2026-11-13")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    );
  });
  it("returns yesterday in UTC by default and handles month boundaries", () => {
    expect(gibsDate(1, new Date("2026-11-14T02:00:00Z"))).toBe("2026-11-13");
    expect(gibsDate(1, new Date("2026-12-01T00:30:00Z"))).toBe("2026-11-30");
    expect(gibsDate(30, new Date("2026-11-14T02:00:00Z"))).toBe("2026-10-15");
  });
  it("gives every overlay a confirmed id and a legend with a source", () => {
    for (const o of OVERLAYS) {
      expect(o.confirmed, o.id).toBe(true);
      expect(o.legend?.source, o.id).toMatch(/^https:\/\/gibs\.earthdata\.nasa\.gov\/colormaps\//);
      expect(o.legend?.stops.length, o.id).toBeGreaterThan(2);
      expect(o.legend!.min).toBeLessThan(o.legend!.max);
    }
  });
  it("converts the temperature legend range to Celsius and builds a gradient", () => {
    expect(kelvinToCelsius(200)).toBe(-73);
    expect(kelvinToCelsius(350)).toBe(77);
    expect(kelvinToCelsius(273.15)).toBe(0);
    expect(legendGradient({ stops: ["#000", "#fff"], min: 0, max: 1, unit: "index", source: "x" }, "to left")).toBe("linear-gradient(to left, #000, #fff)");
  });
});

describe("weather and soil layers", () => {
  const byKey = (k: string) => OVERLAYS.find((o) => o.key === k)!;
  it("has the five layers confirmed in the 15 Nov 2026 capabilities", () => {
    expect(OVERLAYS.map((o) => o.key)).toEqual(expect.arrayContaining(["airTemp", "wind", "humidity", "rain", "soilWater"]));
  });
  it("asks for the newest month of a monthly layer", () => {
    expect(tileUrl(byKey("wind"), "2026-11-13")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_Surface_Wind_Speed_Monthly/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
    );
  });
  it("uses the newest image when a lagging daily layer has not reached the date yet", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    expect(timeFor(byKey("rain"), "2026-11-14", now)).toBe("default"); // 1 day back, layer runs 2 behind
    expect(timeFor(byKey("rain"), "2026-11-13", now)).toBe("2026-11-13");
    expect(timeFor(byKey("lst"), "2026-11-14", now)).toBe("2026-11-14"); // no lag declared
  });
});
