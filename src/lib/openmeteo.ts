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

// ---- current conditions (checked live on 15 Nov 2026: 15-minute interval, these units) ----------------------------

export interface CurrentWeather {
  /** Local time at the place, ISO without offset, e.g. "2026-11-15T10:45". */
  time: string;
  tempC: number | null; feelsC: number | null; humidityPct: number | null;
  /** Precipitation over the preceding 15 minutes, mm. */
  precipMm: number | null;
  cloudPct: number | null;
  windKmh: number | null; gustKmh: number | null;
  /** Direction the wind blows from, degrees. */
  windFromDeg: number | null;
  code: number | null;
  isDay: boolean;
}

export const CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";
/** Open-Meteo refreshes current conditions every 15 minutes. */
export const CURRENT_REFRESH_MS = 15 * 60 * 1000;

export function buildCurrentUrl(lat: number, lon: number): string {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", lat.toFixed(4));
  u.searchParams.set("longitude", lon.toFixed(4));
  u.searchParams.set("current", CURRENT_FIELDS);
  u.searchParams.set("timezone", "auto");
  return u.toString();
}

interface CurrentJson { current?: Record<string, unknown> }
export function parseCurrent(json: unknown): CurrentWeather {
  const c = (json as CurrentJson)?.current;
  if (!c || typeof c.time !== "string") throw new Error("Unexpected Open-Meteo response: current.time missing");
  return {
    time: c.time,
    tempC: num(c.temperature_2m), feelsC: num(c.apparent_temperature), humidityPct: num(c.relative_humidity_2m),
    precipMm: num(c.precipitation), cloudPct: num(c.cloud_cover),
    windKmh: num(c.wind_speed_10m), gustKmh: num(c.wind_gusts_10m), windFromDeg: num(c.wind_direction_10m),
    code: num(c.weather_code), isDay: c.is_day === 1,
  };
}

export type WeatherKind = "clear" | "mostlyClear" | "partlyCloudy" | "overcast" | "fog" | "drizzle" | "rain" | "snow" | "thunder";
/**
 * WMO weather interpretation codes as listed in the Open-Meteo forecast API docs:
 * 0 clear; 1, 2, 3 mainly clear, partly cloudy, overcast; 45, 48 fog; 51–57 drizzle (incl. freezing);
 * 61–67 and 80–82 rain and showers (incl. freezing); 71–77 and 85–86 snow; 95–99 thunderstorm.
 */
export function weatherKind(code: number | null): WeatherKind | null {
  if (code === null) return null;
  if (code === 0) return "clear";
  if (code === 1) return "mostlyClear";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return null;
}
