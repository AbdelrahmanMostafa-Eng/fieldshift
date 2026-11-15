import { NextResponse, type NextRequest } from "next/server";
import { buildCurrentUrl, parseCurrent } from "@/lib/openmeteo";

// Current conditions (Open-Meteo, free, no key). Open-Meteo updates every 15 minutes; the CDN keeps a copy for 10.
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }
  try {
    const res = await fetch(buildCurrentUrl(lat, lon), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return NextResponse.json({ error: `Current conditions responded ${res.status}` }, { status: 502 });
    return NextResponse.json({ now: parseCurrent(await res.json()) }, { headers: { "cache-control": "public, s-maxage=600" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Current conditions unavailable" }, { status: 502 });
  }
}
