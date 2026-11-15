import { NextResponse, type NextRequest } from "next/server";
import { parseLatLon } from "@/lib/geo";
import { getClimate } from "@/lib/climate";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const at = parseLatLon(req.nextUrl.searchParams);
  if (!at) return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  const { lat, lon } = at;
  try {
    const { series, cached } = await getClimate(lat, lon);
    return NextResponse.json({ series, cached }, { headers: { "cache-control": "public, s-maxage=86400" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Climate lookup failed" }, { status: 502 });
  }
}
