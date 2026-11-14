"use client";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { climatology } from "@/lib/climatology";
import type { ClimateSeries } from "@/lib/rotation/types";

const W = 400, H = 190, PAD = { top: 14, bottom: 26, side: 34 };
const INNER_W = W - PAD.side * 2, INNER_H = H - PAD.top - PAD.bottom;

/** Rounds a range outward to "nice" axis ends. */
function niceRange(lo: number, hi: number, step: number): [number, number] {
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  return a === b ? [a, a + step] : [a, b];
}

/**
 * Twelve-month climate of the picked place: rainfall as bars, mean temperature as a line,
 * each with a band from cooler/drier to warmer/wetter years. Hand-built SVG, no chart library.
 * The plot itself is always drawn left to right (January first); only the text follows the page language.
 */
export function ClimateChart({ climate }: { climate: ClimateSeries }) {
  const t = useTranslations("climate");
  const locale = useLocale();
  const stats = useMemo(() => climatology(climate), [climate]);
  const n = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const monthName = useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { month: "narrow" }), long = new Intl.DateTimeFormat(locale, { month: "long" });
    return (m: number, full = false) => (full ? long : short).format(new Date(2026, m, 1));
  }, [locale]);

  const temps = stats.flatMap((s) => [s.tempLow, s.tempHigh].filter((v): v is number => v !== null));
  const rains = stats.map((s) => s.rainHigh ?? s.rainMm ?? 0);
  if (!temps.length) return <p className="text-sm text-muted">{t("missing")}</p>;

  const [tLo, tHi] = niceRange(Math.min(...temps), Math.max(...temps), 5);
  const rainTop = Math.max(20, Math.ceil(Math.max(...rains) / 20) * 20);
  const slot = INNER_W / 12;
  const x = (m: number) => PAD.side + slot * (m + 0.5);
  const yT = (v: number) => PAD.top + INNER_H * (1 - (v - tLo) / (tHi - tLo));
  const yR = (v: number) => PAD.top + INNER_H * (1 - v / rainTop);
  const base = PAD.top + INNER_H;

  const withTemp = stats.filter((s) => s.tempC !== null);
  const line = withTemp.map((s, i) => `${i ? "L" : "M"}${x(s.month).toFixed(1)} ${yT(s.tempC as number).toFixed(1)}`).join(" ");
  const band = withTemp.length
    ? `${withTemp.map((s, i) => `${i ? "L" : "M"}${x(s.month).toFixed(1)} ${yT(s.tempHigh as number).toFixed(1)}`).join(" ")} ${[...withTemp].reverse().map((s) => `L${x(s.month).toFixed(1)} ${yT(s.tempLow as number).toFixed(1)}`).join(" ")} Z`
    : "";
  const from = climate.years[0], to = climate.years[climate.years.length - 1];
  const warm = withTemp.reduce((a, b) => ((b.tempC as number) > (a.tempC as number) ? b : a));
  const wet = stats.reduce((a, b) => ((b.rainMm ?? -1) > (a.rainMm ?? -1) ? b : a));
  // Under 1 mm in the wettest month reads as "0 mm", which says less than plain words do.
  const summary = (wet.rainMm ?? 0) < 1
    ? t("summaryDry", { warm: monthName(warm.month, true), temp: n.format(warm.tempC as number) })
    : t("summary", { warm: monthName(warm.month, true), temp: n.format(warm.tempC as number), wet: monthName(wet.month, true), rain: n.format(wet.rainMm ?? 0) });

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gold" />{t("temp")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-water" />{t("rain")}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} direction="ltr" className="mt-1 block h-auto w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        {/* horizontal hairlines with both scales: temperature on one side, rain on the other */}
        {[0, 0.5, 1].map((k) => {
          const y = PAD.top + INNER_H * (1 - k);
          return (
            <g key={k}>
              <line x1={PAD.side} x2={W - PAD.side} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray={k === 0 ? undefined : "2 4"} />
              <text x={PAD.side - 6} y={y + 3.5} textAnchor="end" className="fill-[var(--muted)] font-mono text-[10px]">{n.format(tLo + (tHi - tLo) * k)}°</text>
              <text x={W - PAD.side + 6} y={y + 3.5} textAnchor="start" className="fill-[var(--muted)] font-mono text-[10px]">{n.format(rainTop * k)}</text>
            </g>
          );
        })}
        {/* rain: a bar for the middle year, a thin whisker from drier to wetter years */}
        {stats.map((s) => s.rainMm !== null && (
          <g key={s.month}>
            <rect x={x(s.month) - slot * 0.3} width={slot * 0.6} y={yR(s.rainMm)} height={Math.max(0, base - yR(s.rainMm))} rx="2" fill="var(--water)" opacity=".7" />
            {s.rainLow !== null && s.rainHigh !== null && <line x1={x(s.month)} x2={x(s.month)} y1={yR(s.rainHigh)} y2={yR(s.rainLow)} stroke="var(--water)" strokeWidth="1.5" strokeLinecap="round" />}
          </g>
        ))}
        {/* temperature: band between cooler and warmer years, line for the middle year */}
        {band && <path d={band} fill="var(--gold)" opacity=".2" />}
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {withTemp.map((s) => <circle key={s.month} cx={x(s.month)} cy={yT(s.tempC as number)} r="2.2" fill="var(--surface)" stroke="var(--gold)" strokeWidth="1.5" />)}
        {stats.map((s) => <text key={s.month} x={x(s.month)} y={H - 8} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">{monthName(s.month)}</text>)}
        <text x={PAD.side - 6} y={10} textAnchor="end" className="fill-[var(--muted)] font-mono text-[9px]">°C</text>
        <text x={W - PAD.side + 6} y={10} textAnchor="start" className="fill-[var(--muted)] font-mono text-[9px]">mm</text>
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-muted">
        <p className="text-ink">{summary}</p>
        <p className="mt-1">{t("band")}</p>
        <p className="mt-2"><span className="fs-chip">{t("source", { from: String(from), to: String(to) })}</span></p>
      </figcaption>
    </figure>
  );
}
