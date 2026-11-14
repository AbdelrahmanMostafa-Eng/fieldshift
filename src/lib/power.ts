import type { ClimateSeries, Monthly } from "@/lib/rotation/types";

export const POWER_PARAMS = ["T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"] as const;
const FILL = -999;

export function buildPowerMonthlyUrl(o: { lat: number; lon: number; startYear: number; endYear: number }): string {
  const u = new URL("https://power.larc.nasa.gov/api/temporal/monthly/point");
  u.searchParams.set("parameters", POWER_PARAMS.join(","));
  u.searchParams.set("community", "AG");
  u.searchParams.set("longitude", o.lon.toFixed(4));
  u.searchParams.set("latitude", o.lat.toFixed(4));
  u.searchParams.set("start", String(o.startYear));
  u.searchParams.set("end", String(o.endYear));
  u.searchParams.set("format", "JSON");
  return u.toString();
}

interface PowerJson {
  properties?: { parameter?: Record<string, Record<string, number>> };
}

function toMonthly(series: Record<string, number> | undefined, years: number[]): Monthly {
  return years.map((y) =>
    Array.from({ length: 12 }, (_, m) => {
      const v = series?.[`${y}${String(m + 1).padStart(2, "0")}`];
      return typeof v === "number" && v !== FILL && Number.isFinite(v) ? v : null;
    }),
  );
}

/** Turns a POWER monthly/point response into year × month arrays. Month 13 (annual) is ignored. */
export function parsePowerMonthly(json: unknown, meta: { lat: number; lon: number }): ClimateSeries {
  const p = (json as PowerJson)?.properties?.parameter;
  if (!p || !p.T2M) throw new Error("Unexpected POWER response: properties.parameter.T2M missing");
  const years = [...new Set(Object.keys(p.T2M).map((k) => Number(k.slice(0, 4))))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  return {
    years,
    T2M: toMonthly(p.T2M, years),
    PRECTOTCORR: toMonthly(p.PRECTOTCORR, years),
    ALLSKY_SFC_SW_DWN: toMonthly(p.ALLSKY_SFC_SW_DWN, years),
    meta: { ...meta, source: "NASA POWER (AG community, monthly)", fetchedAt: new Date().toISOString() },
  };
}

/** Round to a 0.25° cell so nearby farms share one cache row. */
export function cellKey(lat: number, lon: number, startYear: number, endYear: number) {
  const r = (v: number) => (Math.round(v * 4) / 4).toFixed(2);
  return { lat: Number(r(lat)), lon: Number(r(lon)), key: `monthly:${r(lat)}:${r(lon)}:${startYear}-${endYear}` };
}
