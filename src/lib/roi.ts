export interface EconomicsInput {
  yieldTHa: number;
  priceUsdPerT: number;
  costUsdHa: number;
  areaHa?: number;
}

export interface EconomicsResult {
  revenue: number;
  totalCost: number;
  net: number;
  roiPct: number | null;       // null when cost is zero
  breakEvenPrice: number | null; // price per tonne that covers cost at this yield
  breakEvenYield: number | null; // t/ha that covers cost at this price
}

export function economics(i: EconomicsInput): EconomicsResult {
  const area = i.areaHa ?? 1;
  const revenue = i.yieldTHa * i.priceUsdPerT * area;
  const totalCost = i.costUsdHa * area;
  const net = revenue - totalCost;
  return {
    revenue,
    totalCost,
    net,
    roiPct: totalCost > 0 ? (net / totalCost) * 100 : null,
    breakEvenPrice: i.yieldTHa > 0 ? i.costUsdHa / i.yieldTHa : null,
    breakEvenYield: i.priceUsdPerT > 0 ? i.costUsdHa / i.priceUsdPerT : null,
  };
}

/** rates: units of each currency per 1 USD, e.g. { EUR: 0.92 } */
export type Rates = Record<string, number>;

export function fromUsd(amountUsd: number, currency: string, rates: Rates): number | null {
  if (currency === "USD") return amountUsd;
  const r = rates[currency];
  return typeof r === "number" && Number.isFinite(r) ? amountUsd * r : null;
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 2,
  }).format(amount);
}

export function listCurrencies(locale: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => ({ code, name: names.of(code) ?? code }));
}
