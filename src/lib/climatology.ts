import { percentile } from "@/lib/rotation/engine";
import type { ClimateSeries, Monthly } from "@/lib/rotation/types";

/** One calendar month, summarised across all the years in the series. null = no usable value for that month. */
export interface MonthStat {
  month: number; // 0 = January
  /** Mean temperature (°C): the middle year, and the 10th and 90th percentile years. */
  tempC: number | null; tempLow: number | null; tempHigh: number | null;
  /** Rainfall for the whole month (mm): the middle year, and the 10th and 90th percentile years. */
  rainMm: number | null; rainLow: number | null; rainHigh: number | null;
  /** All-sky sunlight reaching the ground (MJ/m² per day), the middle year. */
  solar: number | null;
  /** How many years had a value for this month (the smaller of the two counts). */
  years: number;
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

function column(data: Monthly, month: number, scale: (v: number, yearIndex: number) => number): number[] {
  const out: number[] = [];
  data.forEach((row, yi) => { const v = row?.[month]; if (typeof v === "number" && Number.isFinite(v)) out.push(scale(v, yi)); });
  return out.sort((a, b) => a - b);
}

/**
 * Twelve-month climatology from a NASA POWER monthly series.
 * Temperature stays in °C. Rain arrives as mm per day and is turned into mm per month with the real length of each month.
 * The 10th to 90th percentile spread across years is kept, so the chart can show how much one year differs from another.
 */
export function climatology(series: ClimateSeries): MonthStat[] {
  return Array.from({ length: 12 }, (_, month) => {
    const temps = column(series.T2M, month, (v) => v);
    const rains = column(series.PRECTOTCORR, month, (v, yi) => v * daysInMonth(series.years[yi] ?? 2001, month));
    const sun = column(series.ALLSKY_SFC_SW_DWN ?? [], month, (v) => v);
    const pick = (xs: number[], p: number) => (xs.length ? percentile(xs, p) : null);
    return {
      month,
      tempC: pick(temps, 0.5), tempLow: pick(temps, 0.1), tempHigh: pick(temps, 0.9),
      rainMm: pick(rains, 0.5), rainLow: pick(rains, 0.1), rainHigh: pick(rains, 0.9),
      solar: pick(sun, 0.5),
      years: Math.min(temps.length, rains.length),
    };
  });
}
