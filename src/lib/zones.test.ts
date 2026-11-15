import { describe, expect, it } from "vitest";
import { CROPS } from "@/data/crops";
import live from "./__fixtures__/power-regional.json";
import gwet from "./__fixtures__/power-regional-gwetroot.json";
import { buildRegionalUrl, landCells, mergeCells, parseRegional, scoreZones, zoneBox, zoneLevel, zonesGeoJson, ZONE_SPAN_DEG } from "./zones";

const crop = (id: string) => CROPS.find((c) => c.id === id)!;

describe("zone box and URL", () => {
  it("is 9° square around the point and stays inside the globe", () => {
    const b = zoneBox(24.69, 46.72);
    expect(b.latMax - b.latMin).toBe(ZONE_SPAN_DEG);
    expect(b.lonMax - b.lonMin).toBe(ZONE_SPAN_DEG);
    expect(b.latMin).toBeLessThan(24.69); expect(b.latMax).toBeGreaterThan(24.69);
    const polar = zoneBox(89, 179);
    expect(polar.latMax).toBeLessThanOrEqual(90); expect(polar.lonMax).toBeLessThanOrEqual(180);
  });
  it("asks POWER for one parameter, AG community, within 10°", () => {
    const u = new URL(buildRegionalUrl("T2M", zoneBox(24.69, 46.72)));
    expect(u.pathname).toBe("/api/temporal/climatology/regional");
    expect(u.searchParams.get("parameters")).toBe("T2M");
    expect(u.searchParams.get("community")).toBe("AG");
    expect(Number(u.searchParams.get("latitude-max")) - Number(u.searchParams.get("latitude-min"))).toBeLessThanOrEqual(10);
  });
});

describe("parsing a real POWER regional response (extract saved 15 Nov 2026)", () => {
  const t = parseRegional(live.T2M, "T2M"), p = parseRegional(live.PRECTOTCORR, "PRECTOTCORR");
  it("reads 12 months per cell and leaves out the annual value", () => {
    expect(t.size).toBe(4);
    for (const v of t.values()) expect(v).toHaveLength(12);
  });
  it("merges temperature and rain by cell", () => {
    const cells = mergeCells(t, p);
    expect(cells).toHaveLength(4);
    expect(cells[0].p.every((v) => v === null || v >= 0)).toBe(true);
  });
  it("treats cells without root-zone soil wetness as water (real extract, Nile delta coast)", () => {
    // 30.0N 30.0E and 31.0N 30.0E are land west of the delta; 32.5N 30.0E and 33.0N 30.625E are open Mediterranean.
    const land = landCells(parseRegional(gwet, "GWETROOT"));
    expect([...land].sort()).toEqual(["30,30", "31,30"]);
    const row = (lat: number, lon: number) => ({ type: "Feature", geometry: { coordinates: [lon, lat, 0] }, properties: { parameter: { T2M: { JAN: 15 }, PRECTOTCORR: { JAN: 1 } } } });
    const tp = { features: [row(30, 30), row(32.5, 30)] };
    expect(mergeCells(parseRegional(tp, "T2M"), parseRegional(tp, "PRECTOTCORR"), land).map((c) => `${c.lat},${c.lon}`)).toEqual(["30,30"]);
    expect(mergeCells(parseRegional(tp, "T2M"), parseRegional(tp, "PRECTOTCORR"))).toHaveLength(2);
  });
  it("maps -999 to null and rejects a response without features", () => {
    const m = parseRegional({ features: [{ geometry: { coordinates: [1, 2, 0] }, properties: { parameter: { T2M: { JAN: -999, FEB: 3 } } } }] }, "T2M");
    expect(m.get("2,1")?.slice(0, 2)).toEqual([null, 3]);
    expect(() => parseRegional({ messages: ["x"] }, "T2M")).toThrow(/features/);
  });
});

describe("scoring zones", () => {
  const cells = mergeCells(parseRegional(live.T2M, "T2M"), parseRegional(live.PRECTOTCORR, "PRECTOTCORR"));
  it("uses the library's bands", () => {
    expect(zoneLevel(70)).toBe("good"); expect(zoneLevel(69.9)).toBe("possible"); expect(zoneLevel(40)).toBe("possible"); expect(zoneLevel(39.9)).toBe("poor");
  });
  it("finds rain-fed rice poor around Riyadh and better with irrigation", () => {
    const dry = scoreZones(crop("rice"), cells, false), wet = scoreZones(crop("rice"), cells, true);
    expect(dry.every((z) => z.level === "poor")).toBe(true);
    expect(Math.max(...wet.map((z) => z.score))).toBeGreaterThan(Math.max(...dry.map((z) => z.score)));
  });
  it("draws one closed square per cell", () => {
    const g = zonesGeoJson(scoreZones(crop("sorghum"), cells, true));
    expect(g.features).toHaveLength(cells.length);
    const ring = g.features[0].geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
