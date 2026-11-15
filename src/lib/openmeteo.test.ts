import { describe, expect, it } from "vitest";
import { CURRENT_FIELDS, buildCurrentUrl, buildForecastUrl, buildGeocodeUrl, parseCurrent, parseForecast, parseGeocode, weatherKind } from "./openmeteo";

describe("buildGeocodeUrl", () => {
  it("targets the geocoding host with name, count, language and format", () => {
    const u = new URL(buildGeocodeUrl("Al Kharj", "ar"));
    expect(u.host).toBe("geocoding-api.open-meteo.com");
    expect(u.pathname).toBe("/v1/search");
    expect(u.searchParams.get("name")).toBe("Al Kharj");
    expect(u.searchParams.get("language")).toBe("ar");
    expect(u.searchParams.get("format")).toBe("json");
  });
});

describe("parseGeocode", () => {
  it("builds a label without duplicates and keeps coordinates", () => {
    const hits = parseGeocode({ results: [{ name: "Singapore", latitude: 1.28967, longitude: 103.85007, admin1: "Singapore", country: "Singapore" }] });
    expect(hits).toEqual([{ label: "Singapore", lat: 1.28967, lon: 103.85007 }]);
  });
  it("returns [] when there is no results key (nothing matched)", () => {
    expect(parseGeocode({ generationtime_ms: 0.5 })).toEqual([]);
    expect(parseGeocode(null)).toEqual([]);
  });
  it("skips rows without coordinates", () => {
    expect(parseGeocode({ results: [{ name: "Nowhere" }, { name: "Riyadh", latitude: 24.69, longitude: 46.72, country: "Saudi Arabia" }] }).map((h) => h.label)).toEqual(["Riyadh, Saudi Arabia"]);
  });
});

describe("forecast", () => {
  it("asks for daily temperature, rain and ET0 in the local timezone", () => {
    const u = new URL(buildForecastUrl(24.6877, 46.7219, 7));
    expect(u.searchParams.get("daily")).toBe("temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration");
    expect(u.searchParams.get("timezone")).toBe("auto");
    expect(u.searchParams.get("forecast_days")).toBe("7");
    expect(u.searchParams.get("latitude")).toBe("24.6877");
  });
  it("parses parallel arrays into days and maps bad values to null", () => {
    const days = parseForecast({ daily: { time: ["2026-11-14", "2026-11-15"], temperature_2m_max: [31.2, null], temperature_2m_min: [18.4, 17], precipitation_sum: [0, 2.5], et0_fao_evapotranspiration: [4.1, "x"] } });
    expect(days).toEqual([
      { date: "2026-11-14", tMax: 31.2, tMin: 18.4, rainMm: 0, et0Mm: 4.1 },
      { date: "2026-11-15", tMax: null, tMin: 17, rainMm: 2.5, et0Mm: null },
    ]);
  });
  it("throws a clear error on an unexpected shape", () => {
    expect(() => parseForecast({ error: true, reason: "bad" })).toThrow(/daily\.time/);
  });
});

describe("current conditions", () => {
  // The live response for Riyadh, 15 Nov 2026 10:45 local time.
  const live = { latitude: 24.710016, longitude: 46.688103, timezone: "Asia/Riyadh", current: { time: "2026-11-15T10:45", interval: 900, temperature_2m: 21.3, relative_humidity_2m: 29, apparent_temperature: 19.5, precipitation: 0.0, weather_code: 0, cloud_cover: 0, wind_speed_10m: 7.6, wind_direction_10m: 335, wind_gusts_10m: 24.5, is_day: 1 } };
  it("asks for the current fields in the local timezone", () => {
    const u = new URL(buildCurrentUrl(24.6877, 46.7219));
    expect(u.searchParams.get("current")).toBe(CURRENT_FIELDS);
    expect(u.searchParams.get("timezone")).toBe("auto");
  });
  it("parses the real response", () => {
    expect(parseCurrent(live)).toEqual({ time: "2026-11-15T10:45", tempC: 21.3, feelsC: 19.5, humidityPct: 29, precipMm: 0, cloudPct: 0, windKmh: 7.6, gustKmh: 24.5, windFromDeg: 335, code: 0, isDay: true });
  });
  it("throws on an unexpected shape", () => { expect(() => parseCurrent({ daily: {} })).toThrow(/current\.time/); });
  it("maps WMO codes to kinds", () => {
    expect([0, 1, 2, 3, 45, 48, 53, 57, 63, 81, 66, 73, 77, 86, 95, 99].map(weatherKind)).toEqual(
      ["clear", "mostlyClear", "partlyCloudy", "overcast", "fog", "fog", "drizzle", "drizzle", "rain", "rain", "rain", "snow", "snow", "snow", "thunder", "thunder"]);
    expect(weatherKind(null)).toBeNull();
    expect(weatherKind(42)).toBeNull();
  });
});
