import type { ClimateSeries, Monthly } from "@/lib/rotation/types";

// T2M_MIN (lowest 2 m air temperature of the month) was confirmed live on the monthly API, 15 Nov 2026.
export const POWER_PARAMS = ["T2M", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"] as const;
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
    ...(p.T2M_MIN ? { T2M_MIN: toMonthly(p.T2M_MIN, years) } : {}),
    PRECTOTCORR: toMonthly(p.PRECTOTCORR, years),
    ALLSKY_SFC_SW_DWN: toMonthly(p.ALLSKY_SFC_SW_DWN, years),
    meta: { ...meta, source: "NASA POWER (AG community, monthly)", fetchedAt: new Date().toISOString() },
  };
}

const complete = (row: (number | null)[] | undefined) => !!row && row.length === 12 && row.every((v) => v !== null);

/**
 * The newest `keep` years that have all twelve months of temperature and rain.
 * POWER publishes a year month by month and fills the months it has not reached with -999 (checked live, 15 Nov 2026:
 * 2026 ended in September for T2M and July for sunlight). Asking for "last year" early in a new year therefore returns a
 * half-empty year, and the engine reads a missing month as no rain, which would look like a drought. Such years at the
 * end of the series are dropped. A series with no complete year is returned unchanged.
 */
export function keepCompleteYears(s: ClimateSeries, keep: number): ClimateSeries {
  let end = s.years.length;
  while (end > 0 && !(complete(s.T2M[end - 1]) && complete(s.PRECTOTCORR[end - 1]))) end--;
  if (end === 0) return s;
  const from = Math.max(0, end - keep);
  const cut = (m: Monthly) => m.slice(from, end);
  return {
    ...s,
    years: s.years.slice(from, end),
    T2M: cut(s.T2M),
    ...(s.T2M_MIN ? { T2M_MIN: cut(s.T2M_MIN) } : {}),
    PRECTOTCORR: cut(s.PRECTOTCORR),
    ALLSKY_SFC_SW_DWN: cut(s.ALLSKY_SFC_SW_DWN),
  };
}

/** Round to a 0.25° cell so nearby farms share one cache row. */
export function cellKey(lat: number, lon: number, startYear: number, endYear: number) {
  const r = (v: number) => (Math.round(v * 4) / 4).toFixed(2);
  return { lat: Number(r(lat)), lon: Number(r(lon)), key: `monthly:${r(lat)}:${r(lon)}:${startYear}-${endYear}` };
}
