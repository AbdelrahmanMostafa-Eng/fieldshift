"use client";
import { useLocale, useTranslations } from "next-intl";
import { weatherKind, type CurrentWeather, type WeatherKind } from "@/lib/openmeteo";
import { Icon, type IconName } from "./ui/Icon";

const KIND_ICON: Record<WeatherKind, IconName> = {
  clear: "sun", mostlyClear: "partly", partlyCloudy: "partly", overcast: "cloud", fog: "fog", drizzle: "rain", rain: "rain", snow: "snow", thunder: "storm",
};
const iconFor = (w: CurrentWeather): IconName => {
  const k = weatherKind(w.code);
  if (!k) return "cloud";
  if (!w.isDay && (k === "clear" || k === "mostlyClear")) return "moon";
  return KIND_ICON[k];
};
/** "2026-11-15T10:45" → "10:45" in the page's number style. The time is already local to the place. */
function clock(iso: string, locale: string): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** One line for the place summary: icon, temperature, sky. */
export function NowLine({ now }: { now: CurrentWeather }) {
  const t = useTranslations("weather");
  const locale = useLocale();
  const n0 = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
  const kind = weatherKind(now.code);
  return (
    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
      <Icon name={iconFor(now)} size={16} className="text-gold-text" />
      {now.tempC !== null && <span className="font-mono text-ink">{n0(now.tempC)} °C</span>}
      {kind && <span className="truncate">· {t(`kind.${kind}`)}</span>}
      <span className="truncate">· {t("updated", { time: clock(now.time, locale) })}</span>
    </p>
  );
}

/** The full card for the Seasons tab. */
export function NowCard({ now }: { now: CurrentWeather | null }) {
  const t = useTranslations("weather");
  const locale = useLocale();
  const n = (v: number, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  if (!now) return <section><p className="fs-eyebrow">{t("now")}</p><p className="mt-2 text-muted">{t("unavailable")}</p></section>;
  const kind = weatherKind(now.code);
  const rows: [string, IconName, string][] = [
    [t("feels"), "sun", now.feelsC === null ? "–" : `${n(now.feelsC)} °C`],
    [t("humidity"), "drop", now.humidityPct === null ? "–" : `${n(now.humidityPct)} %`],
    [t("wind"), "wind", now.windKmh === null ? "–" : `${n(now.windKmh)} km/h${now.windFromDeg === null ? "" : ` · ${t("from", { deg: n(now.windFromDeg) })}`}`],
    [t("gusts"), "wind", now.gustKmh === null ? "–" : `${n(now.gustKmh)} km/h`],
    [t("rain"), "rain", now.precipMm === null ? "–" : `${n(now.precipMm, 1)} mm`],
    [t("clouds"), "cloud", now.cloudPct === null ? "–" : `${n(now.cloudPct)} %`],
  ];
  return (
    <section aria-live="polite">
      <p className="fs-eyebrow">{t("now")}</p>
      <div className="mt-2 flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-content-center rounded-lg border border-line bg-paper text-gold-text"><Icon name={iconFor(now)} size={30} /></span>
        <div>
          <p className="tnum font-serif text-4xl leading-none">{now.tempC === null ? "–" : `${n(now.tempC)} °C`}</p>
          <p className="mt-1 text-sm text-muted">{kind ? t(`kind.${kind}`) : ""}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {rows.map(([k, icon, v]) => (
          <div key={k} className="min-w-0"><dt className="flex items-center gap-1 text-xs text-muted"><Icon name={icon} size={14} />{k}</dt><dd className="mt-0.5 font-mono text-sm" dir="ltr">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{t("updated", { time: clock(now.time, locale) })}</p>
      <p className="mt-1"><span className="fs-chip text-muted">{t("source")}</span></p>
    </section>
  );
}
