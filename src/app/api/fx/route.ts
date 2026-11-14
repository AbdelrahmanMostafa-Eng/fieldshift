import { NextResponse } from "next/server";

// Open-access endpoint of ExchangeRate-API. Daily rates; attribution is required (see footer).
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const j = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
    if (!j.rates) throw new Error("fx: no rates");
    return NextResponse.json({ rates: j.rates, updated: j.time_last_update_utc ?? null });
  } catch {
    // The UI falls back to a manual rate box when this fails.
    return NextResponse.json({ error: "Exchange rates unavailable" }, { status: 502 });
  }
}
