"use client";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROP_BY_ID, cropName } from "@/data/crops";
import { SEASON_RULES } from "@/data/reference";
import { climatology } from "@/lib/climatology";
import { plantingWindow, seasons, type Fit } from "@/lib/farm";
import type { ForecastDay } from "@/lib/openmeteo";
import type { ClimateSeries } from "@/lib/rotation/types";
import { ClimateChart } from "./ClimateChart";

const FIT_CLASS: Record<Fit, string> = { good: "bg-gold", possible: "bg-gold/35", no: "bg-line", unknown: "border border-dashed border-line-strong" };

/** Seasons for the picked place: the climate chart, the year in plain words, planting windows by temperature, and the 7-day forecast. */
export function SeasonsPanel({ climate, forecast, plan }: { climate: ClimateSeries; forecast: ForecastDay[] | null; plan: string[] }) {
  const t = useTranslations("seasons");
  const locale = useLocale();
  const stats = useMemo(() => climatology(climate), [climate]);
  const year = useMemo(() => seasons(stats), [stats]);
  const n = (v: number, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  const monthName = (m: number, style: "short" | "narrow" | "long" = "short") => new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2026, m, 1));
  const list = (months: number[]) => (months.length ? new Intl.ListFormat(locale, { style: "narrow", type: "unit" }).format(months.map((m) => monthName(m))) : t("none"));
  const crops = [...new Set(plan)].map((id) => CROP_BY_ID.get(id)).filter((c) => !!c);
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className="mt-5 space-y-6 text-sm">
      <section>
        <p className="fs-eyebrow mb-3">{t("title")}</p>
        <ClimateChart climate={climate} />
      </section>

      <section className="border-t border-line pt-5">
        <p className="fs-eyebrow">{t("year")}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {([["warm", year.warm], ["cool", year.cool], ["wet", year.wet], ["dry", year.dry]] as const).map(([k, months]) => (
            <div key={k} className="contents"><dt className="text-muted">{t(k)}</dt><dd>{list(months)}</dd></div>
          ))}
        </dl>
        {year.yearMeanC !== null && <p className="mt-3 text-xs leading-relaxed text-muted" title={`${SEASON_RULES.tempDeltaC.source} ${SEASON_RULES.wetMonthMm.source}`}>
          {t("rule", { delta: n(SEASON_RULES.tempDeltaC.value), mean: n(year.yearMeanC, 1), wet: n(SEASON_RULES.wetMonthMm.value) })}
        </p>}
      </section>

      <section className="border-t border-line pt-5">
        <p className="fs-eyebrow">{t("windows")}</p>
        <div className="mt-3 grid grid-cols-[minmax(4.5rem,auto)_repeat(12,minmax(0,1fr))] items-center gap-x-1 gap-y-2" dir="ltr">
          <span />
          {stats.map((s) => <span key={s.month} className="text-center text-[10px] text-muted">{monthName(s.month, "narrow")}</span>)}
          {crops.map((c) => {
            const fits = plantingWindow(c, stats);
            return (
              <div key={c.id} className="contents" role="img" aria-label={`${t("plantIn", { crop: cropName(c.id, locale) })}: ${fits.map((f, m) => `${monthName(m, "long")} ${t(f)}`).join(", ")}`}>
                <span className="truncate pe-1 text-xs" dir="auto">{cropName(c.id, locale)}</span>
                {fits.map((f, m) => <span key={m} title={`${monthName(m, "long")}: ${t(f)}`} className={`h-5 rounded-[3px] ${FIT_CLASS[f]}`} />)}
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {(["good", "possible", "no"] as const).map((f) => <span key={f} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[2px] ${FIT_CLASS[f]}`} />{t(f)}</span>)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t("windowsNote")}</p>
      </section>

      <section className="border-t border-line pt-5">
        <p className="fs-eyebrow">{t("forecast")}</p>
        {forecast && forecast.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {forecast.slice(0, 7).map((d) => (
                <div key={d.date} className="rounded-md bg-paper px-0.5 py-2">
                  <p className="text-[11px] text-muted">{day(d.date)}</p>
                  <p className="mt-1 font-mono text-sm">{d.tMax === null ? "–" : `${n(d.tMax)}°`}</p>
                  <p className="font-mono text-xs text-muted">{d.tMin === null ? "–" : `${n(d.tMin)}°`}</p>
                  <p className="mt-1 font-mono text-[11px] text-water">{d.rainMm === null ? "–" : n(d.rainMm, 1)}</p>
                  <p className="font-mono text-[11px] text-muted">{d.et0Mm === null ? "–" : n(d.et0Mm, 1)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("forecastKey")}</p>
          </>
        ) : <p className="mt-2 text-muted">{t("forecastNone")}</p>}
        <p className="mt-2"><span className="fs-chip text-muted">{t("forecastSource")}</span></p>
      </section>
    </div>
  );
}
