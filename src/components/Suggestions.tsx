"use client";
import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { placeFit } from "@/lib/rotation/engine";
import type { ClimateSeries } from "@/lib/rotation/types";
import { zoneLevel, type ZoneLevel } from "@/lib/zones";
import { CropIcon } from "./ui/CropIcon";
import { Icon } from "./ui/Icon";

/** Same colours as the zones on the map. */
export const LEVEL_DOT: Record<ZoneLevel, string> = { good: "bg-[#3f9d4a]", possible: "bg-[#e3b23c]", poor: "bg-[#c8483a]" };

/**
 * The crops that fit the picked place best, from all crops in the library, by the same EcoCrop rule as the library
 * (the lower of the temperature and rain scores, best planting month). A starting point, not a recommendation.
 */
export function Suggestions({ climate, irrigated, plan, canAdd, onAdd, onZones, zoneCrop, count = 6 }: {
  climate: ClimateSeries; irrigated: boolean; plan: string[]; canAdd: boolean;
  onAdd: (id: string) => void; onZones: (id: string) => void; zoneCrop: string | null; count?: number;
}) {
  const t = useTranslations("suggest");
  const hid = useId();
  const locale = useLocale();
  const ranked = useMemo(() => CROPS.map((c) => ({ c, fit: placeFit(c, climate, irrigated) }))
    .filter((x): x is { c: (typeof CROPS)[number]; fit: NonNullable<ReturnType<typeof placeFit>> } => !!x.fit)
    .sort((a, b) => b.fit.score - a.fit.score).slice(0, count), [climate, irrigated, count]);
  const month = (m: number) => new Intl.DateTimeFormat(locale, { calendar: "gregory", month: "long" }).format(new Date(2026, m, 1));
  const n0 = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);

  return (
    <section aria-labelledby={hid} className="mt-6 border-t border-line pt-5">
      <h3 id={hid} className="fs-eyebrow">{t("title")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{irrigated ? t("noteIrrigated") : t("note")}</p>
      <ul className="mt-2 divide-y divide-line">
        {ranked.map(({ c, fit }) => {
          const level = zoneLevel(fit.score), inPlan = plan.includes(c.id);
          return (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-10 w-10 shrink-0 place-content-center rounded-md border border-line bg-paper text-gold-text"><CropIcon icon={c.icon} size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2"><span className="truncate font-serif text-base">{cropName(c.id, locale)}</span>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />
                  <span className="shrink-0 font-mono text-xs">{n0(fit.score)}/100</span></p>
                <p className="truncate text-xs text-muted">{t(`level.${level}`)} · {t("plantIn", { month: month(fit.month) })}</p>
              </div>
              <button type="button" onClick={() => onZones(c.id)} aria-pressed={zoneCrop === c.id} aria-label={t("zonesFor", { crop: cropName(c.id, locale) })} title={t("zones")}
                className={`fs-btn fs-btn-icon ${zoneCrop === c.id ? "fs-btn-primary" : "fs-btn-quiet"}`}><Icon name="map" size={18} /></button>
              <button type="button" onClick={() => onAdd(c.id)} disabled={!canAdd || inPlan} aria-label={t("addFor", { crop: cropName(c.id, locale) })} title={inPlan ? t("inPlan") : canAdd ? t("add") : t("planFull")}
                className="fs-btn fs-btn-quiet fs-btn-icon disabled:opacity-40">{inPlan ? <Icon name="check" size={18} /> : <Icon name="plus" size={18} />}</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
