import { NextResponse, type NextRequest } from "next/server";
import { POWER_GRID, buildRegionalUrl, landCells, mergeCells, parseRegional, zoneBox, type RegionalParam } from "@/lib/zones";

export const maxDuration = 30;

// Long-term monthly means around a point, for the crop suitability zones. Three requests, as POWER takes one parameter at a time:
// temperature, rain, and root-zone soil wetness, which has no value over open water and so masks the sea.
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }
  const box = zoneBox(lat, lon);
  try {
    const get = async (param: RegionalParam) => {
      const res = await fetch(buildRegionalUrl(param, box), { next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(25_000) });
      if (!res.ok) throw new Error(`POWER regional ${param}: ${res.status}`);
      return parseRegional(await res.json(), param);
    };
    const [t, p, w] = await Promise.all([get("T2M"), get("PRECTOTCORR"), get("GWETROOT")]);
    const cells = mergeCells(t, p, landCells(w));
    return NextResponse.json({ box, grid: POWER_GRID, cells }, { headers: { "cache-control": "public, s-maxage=604800" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Zone lookup failed" }, { status: 502 });
  }
}
