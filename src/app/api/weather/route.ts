import { NextResponse, type NextRequest } from "next/server";
import { buildForecastUrl, parseForecast } from "@/lib/openmeteo";

// Free 7-day forecast (Open-Meteo). No key. Cached 1 h at the CDN.
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }
  try {
    const res = await fetch(buildForecastUrl(lat, lon, 7), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return NextResponse.json({ error: `Forecast responded ${res.status}` }, { status: 502 });
    return NextResponse.json({ days: parseForecast(await res.json()) }, { headers: { "cache-control": "public, s-maxage=3600" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Forecast unavailable" }, { status: 502 });
  }
}
