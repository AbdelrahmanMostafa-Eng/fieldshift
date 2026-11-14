import { NextResponse, type NextRequest } from "next/server";
import { getClimate } from "@/lib/climate";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }
  try {
    const { series, cached } = await getClimate(lat, lon);
    return NextResponse.json({ series, cached }, { headers: { "cache-control": "public, s-maxage=86400" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Climate lookup failed" }, { status: 502 });
  }
}
