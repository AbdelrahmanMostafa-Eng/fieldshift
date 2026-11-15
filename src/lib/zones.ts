import { placeFit } from "@/lib/rotation/engine";
import type { ClimateSeries, Crop } from "@/lib/rotation/types";

/**
 * Suitability zones for one crop around the picked place.
 * Data: NASA POWER climatology/regional API (one parameter per request, at most 10° × 10°, native grid 0.5° lat × 0.625° lon,
 * monthly means 2001–2025; all checked live on 15 Nov 2026). Each grid cell is scored with the same EcoCrop rule as the
 * crop library (placeFit), from that cell's long-term monthly means.
 * Open water is left out: POWER gives no root-zone soil wetness (GWETROOT, fill value -999) for a cell with no land,
 * so that parameter, from the same API and grid, serves as the land mask (checked live on the Nile delta coast, 15 Nov 2026).
 */

export const ZONE_SPAN_DEG = 9; // the box is 9° × 9°, under POWER's 10° limit
export const POWER_GRID = { dLat: 0.5, dLon: 0.625, source: "NASA POWER climatology (regional), monthly means 2001–2025, native 0.5° × 0.625° grid; open water (no GWETROOT value) left out" } as const;
/** Display bands, the same as the crop library: a reading aid stated on screen, not an agronomic standard. */
export const ZONE_BANDS = { good: 70, possible: 40 } as const;
export type ZoneLevel = "good" | "possible" | "poor";
/** Banded on the whole number the screen shows, so a score shown as "70/100" is never coloured as "possible". */
export const zoneLevel = (score: number): ZoneLevel => {
  const shown = Math.round(score);
  return shown >= ZONE_BANDS.good ? "good" : shown >= ZONE_BANDS.possible ? "possible" : "poor";
};

export interface Box { latMin: number; latMax: number; lonMin: number; lonMax: number }
export interface ZoneCell { lat: number; lon: number; t: (number | null)[]; p: (number | null)[] }

const round = (v: number, step: number) => Math.round(v / step) * step;

/** A box of ZONE_SPAN_DEG around the point, kept inside the globe and snapped to whole degrees so nearby picks share a cache entry. */
export function zoneBox(lat: number, lon: number): Box {
  const half = ZONE_SPAN_DEG / 2;
  const cLat = Math.min(90 - half, Math.max(-90 + half, round(lat, 1)));
  const cLon = Math.min(180 - half, Math.max(-180 + half, round(lon, 1)));
  return { latMin: cLat - half, latMax: cLat + half, lonMin: cLon - half, lonMax: cLon + half };
}

export type RegionalParam = "T2M" | "PRECTOTCORR" | "GWETROOT";
export function buildRegionalUrl(param: RegionalParam, b: Box): string {
  const u = new URL("https://power.larc.nasa.gov/api/temporal/climatology/regional");
  u.searchParams.set("latitude-min", String(b.latMin));
  u.searchParams.set("latitude-max", String(b.latMax));
  u.searchParams.set("longitude-min", String(b.lonMin));
  u.searchParams.set("longitude-max", String(b.lonMax));
  u.searchParams.set("parameters", param);
  u.searchParams.set("community", "AG");
  u.searchParams.set("format", "JSON");
  return u.toString();
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const FILL = -999;
interface RegionalJson { features?: { geometry?: { coordinates?: number[] }; properties?: { parameter?: Record<string, Record<string, number>> } }[] }

/** Grid cell centre → 12 monthly values. The annual ("ANN") value is ignored; -999 becomes null. */
export function parseRegional(json: unknown, param: string): Map<string, (number | null)[]> {
  const f = (json as RegionalJson)?.features;
  if (!Array.isArray(f)) throw new Error("Unexpected POWER regional response: features missing");
  const out = new Map<string, (number | null)[]>();
  for (const feat of f) {
    const [lon, lat] = feat.geometry?.coordinates ?? [];
    const v = feat.properties?.parameter?.[param];
    if (typeof lat !== "number" || typeof lon !== "number" || !v) continue;
    out.set(`${lat},${lon}`, MONTHS.map((m) => (typeof v[m] === "number" && v[m] !== FILL && Number.isFinite(v[m]) ? v[m] : null)));
  }
  return out;
}

/** Cells that have land: at least one month of root-zone soil wetness (GWETROOT). */
export function landCells(gwetroot: Map<string, (number | null)[]>): Set<string> {
  return new Set([...gwetroot].filter(([, v]) => v.some((x) => x !== null)).map(([k]) => k));
}

/** Cells that have both temperature and rain, and land when a land set is given. */
export function mergeCells(t: Map<string, (number | null)[]>, p: Map<string, (number | null)[]>, land?: Set<string>): ZoneCell[] {
  const out: ZoneCell[] = [];
  for (const [k, tv] of t) {
    const pv = p.get(k);
    if (!pv || (land && !land.has(k))) continue;
    const [lat, lon] = k.split(",").map(Number);
    out.push({ lat, lon, t: tv, p: pv });
  }
  return out;
}

/** A one-"year" series from a cell's long-term monthly means, so the same scoring as everywhere else applies. */
const cellSeries = (c: ZoneCell): ClimateSeries => ({
  years: [0], T2M: [c.t], PRECTOTCORR: [c.p], ALLSKY_SFC_SW_DWN: [Array(12).fill(null)],
  meta: { lat: c.lat, lon: c.lon, source: POWER_GRID.source, fetchedAt: "" },
});

export interface ZoneScore { lat: number; lon: number; score: number; level: ZoneLevel }
export function scoreZones(crop: Crop, cells: ZoneCell[], irrigated: boolean): ZoneScore[] {
  return cells.flatMap((c) => {
    if (c.t.every((v) => v === null)) return [];
    const fit = placeFit(crop, cellSeries(c), irrigated);
    return fit ? [{ lat: c.lat, lon: c.lon, score: fit.score, level: zoneLevel(fit.score) }] : [];
  });
}

/** GeoJSON squares, one per grid cell, for the map. */
export function zonesGeoJson(scores: ZoneScore[]) {
  const hy = POWER_GRID.dLat / 2, hx = POWER_GRID.dLon / 2;
  return {
    type: "FeatureCollection" as const,
    features: scores.map((s) => ({
      type: "Feature" as const,
      properties: { level: s.level, score: Math.round(s.score) },
      geometry: { type: "Polygon" as const, coordinates: [[[s.lon - hx, s.lat - hy], [s.lon + hx, s.lat - hy], [s.lon + hx, s.lat + hy], [s.lon - hx, s.lat + hy], [s.lon - hx, s.lat - hy]]] },
    })),
  };
}
