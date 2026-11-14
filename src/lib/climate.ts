import { buildPowerMonthlyUrl, cellKey, parsePowerMonthly } from "@/lib/power";
import type { ClimateSeries } from "@/lib/rotation/types";

// NASA POWER needs no key. Results are cached by Vercel's CDN (see the cache-control header in /api/climate),
// so no database is required. Coordinates are rounded to a 0.25° cell so nearby farms share one cached response.
export async function getClimate(lat: number, lon: number): Promise<{ series: ClimateSeries; cached: boolean }> {
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = endYear - 23; // 24 seasons
  const cell = cellKey(lat, lon, startYear, endYear);

  const res = await fetch(buildPowerMonthlyUrl({ lat: cell.lat, lon: cell.lon, startYear, endYear }), {
    signal: AbortSignal.timeout(25_000),
    headers: { accept: "application/json" },
    next: { revalidate: 30 * 24 * 3600 }, // Next.js data cache: reuse for 30 days
  });
  if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
  const series = parsePowerMonthly(await res.json(), { lat: cell.lat, lon: cell.lon });
  return { series, cached: false };
}
