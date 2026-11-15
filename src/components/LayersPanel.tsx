"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DATE_RANGE_DAYS, OVERLAYS, gibsDate, kelvinToCelsius, legendGradient, legendMid, type GibsLayer } from "@/lib/gibs";
import { Icon } from "./ui/Icon";
import { Range } from "./ui/Range";
import { useDismiss } from "./ui/hooks";

export type OverlayState = Record<string, { on: boolean; opacity: number }>;

export const initialOverlayState = (): OverlayState =>
  Object.fromEntries(OVERLAYS.map((o) => [o.id, { on: false, opacity: o.opacity }]));

interface Props {
  state: OverlayState;
  onChange: (id: string, patch: Partial<{ on: boolean; opacity: number }>) => void;
  /** 1 = yesterday (UTC) … DATE_RANGE_DAYS = oldest. */
  daysBack: number;
  onDaysBack: (n: number) => void;
  rtl: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Icon-only button (phones). */
  compact?: boolean;
  /** "bar": the panel hangs from the header instead of the button, so it stays on screen on phones. */
  anchor?: "self" | "bar";
}

function Legend({ layer, rtl }: { layer: GibsLayer; rtl: boolean }) {
  const t = useTranslations("layers");
  const locale = useLocale();
  const legend = layer.legend;
  if (!legend) return null;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const kelvin = legend.unit === "K";
  // Units are symbols (°C, m/s, %, mm/h, m³/m³), written the same in every language.
  const fmt = (v: number) => (kelvin ? `${n.format(kelvinToCelsius(v))} °C` : legend.unit === "index" ? n.format(v) : `${n.format(v)} ${legend.unit}`);
  const unitText = kelvin ? t("lstUnit", { min: n.format(legend.min), max: n.format(legend.max) })
    : layer.key === "ndvi" ? t("ndviUnit")
    : t(`${layer.key as "wind" | "humidity" | "rain" | "soilWater"}Unit`);
  const note = layer.cadence === "rolling8" ? t("ndviNote") : layer.cadence === "monthly" ? t("monthlyNote") : layer.lagDays ? t("lagNote", { days: layer.lagDays }) : "";
  const toward = rtl ? "to left" : "to right";
  const bar = (stops: string[]) => <div className="h-2 flex-1 rounded-full shadow-[inset_0_0_0_1px_var(--line-strong)]" style={{ background: legendGradient({ ...legend, stops }, toward) }} />;
  return (
    <div className="mt-1">
      {legend.second ? (
        // Two ramps over one range (rain and snow): each bar is named, the numbers below serve both.
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-[11px] text-muted">{t(layer.key === "rain" ? "rainShort" : layer.key)}</span>{bar(legend.stops)}</div>
          <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-[11px] text-muted">{t(legend.second.key)}</span>{bar(legend.second.stops)}</div>
        </div>
      ) : <div className="flex">{bar(legend.stops)}</div>}
      {/* Start, middle and end of the bar. The middle is what makes a logarithmic scale readable. */}
      <div className={`mt-1 grid grid-cols-3 font-mono text-[11px] text-muted ${legend.second ? "ps-14" : ""}`}>
        <span dir="ltr" className="text-start">{fmt(legend.min)}</span><span dir="ltr" className="text-center">{fmt(legendMid(legend))}</span><span dir="ltr" className="text-end">{fmt(legend.max)}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{unitText}{note ? ` ${note}` : ""}</p>
    </div>
  );
}

/** Header button plus a small panel: overlay switches, opacity, legends with units, and the image date. */
export function LayersPanel({ state, onChange, daysBack, onDaysBack, rtl, onOpenChange, compact = false, anchor = "self" }: Props) {
  const t = useTranslations("layers");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const active = OVERLAYS.filter((o) => state[o.id]?.on).length;
  const dateLabel = new Intl.DateTimeFormat(locale, { calendar: "gregory", dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${gibsDate(daysBack)}T00:00:00Z`));
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  return (
    <div ref={box} className={anchor === "self" ? "relative" : ""}>
      <button type="button" className={`fs-btn fs-btn-quiet relative ${compact ? "fs-btn-icon" : "px-3"}`} aria-expanded={open} aria-controls={id}
        aria-label={compact ? t("button") : undefined} title={compact ? t("button") : undefined} onClick={() => setOpen((o) => !o)}>
        <Icon name="layers" />
        {!compact && <span>{t("button")}</span>}
        {active > 0 && <span className={`grid h-5 min-w-5 place-content-center rounded-full bg-gold px-1 font-mono text-[11px] text-gold-ink ${compact ? "absolute -end-1 -top-1" : ""}`}>{active}</span>}
      </button>
      {open && (
        <div id={id} role="group" aria-label={t("label")}
          className={`fs-pop absolute top-full z-40 mt-2 max-h-[70dvh] w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto p-4 text-start text-sm ${anchor === "self" ? "end-0" : "end-3"}`}>
          <p className="fs-eyebrow">{t("label")}</p>

          <ul className="mt-2 divide-y divide-line">
            {OVERLAYS.map((o) => {
              const s = state[o.id];
              const pct = Math.round(s.opacity * 100);
              return (
                <li key={o.id} className="py-1">
                  <label className="fs-tap flex w-full justify-between">
                    <span className="font-medium">{t(o.key)}</span>
                    <input type="checkbox" role="switch" className="fs-switch" checked={s.on} onChange={(e) => onChange(o.id, { on: e.target.checked })} />
                  </label>
                  {s.on && (
                    <div className="pb-2">
                      <label className="flex items-center gap-3 text-xs text-muted">
                        <span className="shrink-0">{t("opacity")}</span>
                        <Range min={10} max={100} step={5} value={pct} bubble={`${pct}%`} onChange={(v) => onChange(o.id, { opacity: v / 100 })} />
                        <span className="w-9 shrink-0 text-end font-mono">{pct}%</span>
                      </label>
                      <Legend layer={o} rtl={rtl} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 border-t border-line pt-3">
            <label className="block">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{t("date")}</span>
                <span className="font-mono text-xs text-muted">{dateLabel}</span>
              </span>
              {/* the slider runs old → new in reading direction: its value is "days before the newest day" flipped */}
              <Range min={1} max={DATE_RANGE_DAYS} value={DATE_RANGE_DAYS + 1 - daysBack} bubble={dateLabel} onChange={(v) => onDaysBack(DATE_RANGE_DAYS + 1 - v)} />
            </label>
            <p className="text-[11px] leading-snug text-muted">{t("dateHint", { days: DATE_RANGE_DAYS })}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{t("base")}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{t("sharp")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
