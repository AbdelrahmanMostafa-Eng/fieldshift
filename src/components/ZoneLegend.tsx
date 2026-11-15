"use client";
import { useLocale, useTranslations } from "next-intl";
import { CROP_BY_ID, cropName } from "@/data/crops";
import { POWER_GRID, ZONE_BANDS, type ZoneLevel } from "@/lib/zones";
import { LEVEL_DOT } from "./Suggestions";
import { CropIcon } from "./ui/CropIcon";
import { Icon } from "./ui/Icon";

/** Small floating key for the crop suitability squares on the map. */
export function ZoneLegend({ cropId, status, irrigated, onClose, style }: {
  cropId: string; status: "loading" | "ready" | "failed"; irrigated: boolean; onClose: () => void; style?: React.CSSProperties;
}) {
  const t = useTranslations("zones");
  const locale = useLocale();
  const crop = CROP_BY_ID.get(cropId);
  if (!crop) return null;
  const n = (v: number) => new Intl.NumberFormat(locale).format(v);
  const rows: [ZoneLevel, string][] = [
    ["good", t("good", { min: n(ZONE_BANDS.good) })],
    ["possible", t("possible", { min: n(ZONE_BANDS.possible), max: n(ZONE_BANDS.good - 1) })],
    ["poor", t("poor", { max: n(ZONE_BANDS.possible - 1) })],
  ];
  return (
    <div role="region" aria-label={t("title")} style={style} className="fs-pop absolute z-30 w-[min(17rem,calc(100vw-1.5rem))] p-3 text-start text-sm">
      <div className="flex items-start gap-2">
        <span className="grid h-9 w-9 shrink-0 place-content-center rounded-md border border-line bg-paper text-gold-text"><CropIcon icon={crop.icon} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="fs-eyebrow">{t("title")}</p>
          <p className="truncate font-serif text-base">{cropName(crop.id, locale)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("hide")} title={t("hide")} className="fs-btn fs-btn-quiet fs-btn-icon -me-1 -mt-1"><Icon name="close" size={16} /></button>
      </div>
      {status === "loading" && <p className="mt-2 flex items-center gap-2 text-xs text-muted" role="status"><Icon name="spinner" size={14} />{t("loading")}</p>}
      {status === "failed" && <p className="mt-2 text-xs text-danger" role="alert">{t("failed")}</p>}
      {status === "ready" && (
        <ul className="mt-2 space-y-1">
          {rows.map(([level, label]) => <li key={level} className="flex items-center gap-2 text-xs"><span className={`h-3 w-5 rounded-[3px] opacity-80 ${LEVEL_DOT[level]}`} aria-hidden="true" />{label}</li>)}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-snug text-muted">{irrigated ? t("noteIrrigated") : t("note")}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted" dir="ltr">{POWER_GRID.source}</p>
    </div>
  );
}
