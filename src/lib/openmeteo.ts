// Open-Meteo: free, no API key. Free for non-commercial use, attribution required (CC BY 4.0).
// Docs: https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/geocoding-api
export const OPEN_METEO_CREDIT = "Weather and place search: Open-Meteo.com (CC BY 4.0)";

export interface PlaceHit { label: string; lat: number; lon: number }
export interface ForecastDay { date: string; tMax: number | null; tMin: number | null; rainMm: number | null; et0Mm: number | null }

export function buildGeocodeUrl(q: string, language: string): string {
  const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name", q);
  u.searchParams.set("count", "5");
  u.searchParams.set("language", language);
  u.searchParams.set("format", "json");
  return u.toString();
}

interface GeoJson { results?: { name?: string; latitude?: number; longitude?: number; admin1?: string; country?: string }[] }

/** Open-Meteo returns no `results` key at all when nothing matches. */
export function parseGeocode(json: unknown): PlaceHit[] {
  const rows = (json as GeoJson)?.results;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (typeof r.latitude !== "number" || typeof r.longitude !== "number" || !r.name) return [];
    const label = [r.name, r.admin1, r.country].filter((x, i, a): x is string => !!x && a.indexOf(x) === i).join(", ");
    return [{ label, lat: r.latitude, lon: r.longitude }];
  });
}

export function buildForecastUrl(lat: number, lon: number, days = 7): string {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", lat.toFixed(4));
  u.searchParams.set("longitude", lon.toFixed(4));
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration");
  u.searchParams.set("forecast_days", String(days));
  u.searchParams.set("timezone", "auto");
  return u.toString();
}

interface ForecastJson {
  daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; precipitation_sum?: (number | null)[]; et0_fao_evapotranspiration?: (number | null)[] };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseForecast(json: unknown): ForecastDay[] {
  const d = (json as ForecastJson)?.daily;
  if (!d || !Array.isArray(d.time)) throw new Error("Unexpected Open-Meteo response: daily.time missing");
  return d.time.map((date, i) => ({
    date,
    tMax: num(d.temperature_2m_max?.[i]),
    tMin: num(d.temperature_2m_min?.[i]),
    rainMm: num(d.precipitation_sum?.[i]),
    et0Mm: num(d.et0_fao_evapotranspiration?.[i]),
  }));
}
