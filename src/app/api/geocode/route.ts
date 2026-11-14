import { NextResponse, type NextRequest } from "next/server";
import { buildGeocodeUrl, parseGeocode } from "@/lib/openmeteo";

// Free place search (Open-Meteo Geocoding). No key. Cached at the CDN to stay far below the free daily limit.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2 || q.length > 120) return NextResponse.json({ error: "Query must be 2-120 characters" }, { status: 400 });
  const lang = (req.nextUrl.searchParams.get("lang") ?? "en").slice(0, 5).replace(/[^a-zA-Z-]/g, "") || "en";
  try {
    const res = await fetch(buildGeocodeUrl(q, lang), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return NextResponse.json({ results: [], error: `Place search responded ${res.status}` }, { status: 502 });
    return NextResponse.json({ results: parseGeocode(await res.json()) }, { headers: { "cache-control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ results: [], error: "Place search unavailable" }, { status: 502 });
  }
}
