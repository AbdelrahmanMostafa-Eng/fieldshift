"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { TEXTURE_GROUP_SOURCE } from "@/data/reference";
import { climatology } from "@/lib/climatology";
import { FERTILITY_SOURCE, fertilityNotes } from "@/lib/fertility";
import { plantingWindow, type Fit } from "@/lib/farm";
import { hasEconomics, placeFit, type PlaceFit } from "@/lib/rotation/engine";
import type { ClimateSeries, Crop } from "@/lib/rotation/types";
import { zoneLevel, type ZoneLevel } from "@/lib/zones";
import { CropIcon } from "./ui/CropIcon";
import { Icon } from "./ui/Icon";
import { Segmented } from "./ui/Segmented";

// Display bands for the fit score, shared with the suggestions and the map zones (a reading aid, not an agronomic standard).
const level = zoneLevel;
const LEVEL_BARS: Record<ZoneLevel, number> = { good: 3, possible: 2, poor: 1 };
const FIT_CLASS: Record<Fit, string> = { good: "bg-gold", possible: "bg-gold/35", no: "bg-line", unknown: "border border-dashed border-line-strong" };
const PRICED = CROPS.filter(hasEconomics).length;

function FitMeter({ score, label }: { score: number; label: string }) {
  const bars = LEVEL_BARS[level(score)];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={label}>
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((i) => <span key={i} className={`w-1.5 rounded-[2px] ${i <= bars ? "bg-gold" : "bg-line-strong"}`} style={{ height: 4 + i * 3 }} />)}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

/**
 * The crop library: search, filter by family, sort by how well each crop fits the picked place,
 * open a crop to read its FAO EcoCrop requirements, and put it into the plan.
 */
export function CropLibrary({ plan, onUse, onAdd, onZones, zoneCrop, money, climate, irrigated }: {
  plan: string[]; onUse: (slot: number, id: string) => void; money: (usd: number) => string; climate: ClimateSeries | null; irrigated: boolean;
  /** Adds the crop as a new season; absent when the plan is full. */
  onAdd?: (id: string) => void;
  /** Shows the crop's suitability zones on the map; absent until a place is picked. */
  onZones?: (id: string) => void;
  zoneCrop: string | null;
}) {
  const t = useTranslations("crops");
  const fam = useTranslations("family");
  const ft = useTranslations("fertility");
  const st = useTranslations("soil");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<string>("all");
  const [sort, setSort] = useState<"fit" | "name">("fit");
  const [open, setOpen] = useState<string | null>(null);
  const families = useMemo(() => [...new Set(CROPS.map((c) => c.family))], []);
  const fits = useMemo(() => {
    if (!climate) return null;
    return new Map<string, PlaceFit | null>(CROPS.map((c) => [c.id, placeFit(c, climate, irrigated)]));
  }, [climate, irrigated]);
  const stats = useMemo(() => (climate ? climatology(climate) : null), [climate]);
  const collator = useMemo(() => new Intl.Collator(locale), [locale]);
  const hits = useMemo(() => {
    const s = q.trim().toLocaleLowerCase(locale);
    const list = CROPS.filter((c) => (family === "all" || c.family === family)
      && (!s || `${cropName(c.id, locale)} ${c.name} ${c.scientific} ${(c.aliases ?? []).join(" ")}`.toLocaleLowerCase(locale).includes(s)));
    const byName = (a: Crop, b: Crop) => collator.compare(cropName(a.id, locale), cropName(b.id, locale));
    return fits && sort === "fit" ? list.sort((a, b) => (fits.get(b.id)?.score ?? -1) - (fits.get(a.id)?.score ?? -1) || byName(a, b)) : list.sort(byName);
  }, [q, family, locale, fits, sort, collator]);
  const n = (v: number, d = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  const monthName = (m: number, style: "long" | "narrow" = "long") => new Intl.DateTimeFormat(locale, { calendar: "gregory", month: style }).format(new Date(2026, m, 1));

  return (
    <div className="mt-5 text-sm">
      <p className="fs-eyebrow">{t("title")}</p>
      <label className="relative mt-2 block">
        <Icon name="search" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="fs-field w-full ps-10 text-sm" />
      </label>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("family")}>
        {["all", ...families].map((f) => (
          <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)} className={`fs-chip shrink-0 ${family === f ? "border-gold bg-gold/20 font-medium" : ""}`}>{f === "all" ? t("all") : fam(f)}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" aria-live="polite">{t("count", { count: hits.length })}</p>
        {fits && <Segmented label={t("sort")} value={sort} onChange={setSort} options={[{ value: "fit", label: t("sortFit") }, { value: "name", label: t("sortName") }]} />}
      </div>
      {fits
        ? <p className="mt-2 text-xs leading-relaxed text-muted">{t("fitNote")}</p>
        : <p className="mt-2 flex items-center gap-2 text-xs text-muted"><Icon name="pin" size={16} className="text-gold-text" />{t("pickForFit")}</p>}

      <ul className="mt-1 divide-y divide-line">
        {hits.map((c) => {
          const isOpen = open === c.id;
          const fit = fits?.get(c.id) ?? null;
          const fitLabel = fit ? t(`fit.${level(fit.score)}`) : null;
          const windows = isOpen && stats ? plantingWindow(c, stats) : null;
          const econ = hasEconomics(c) ? c : null;
          return (
            <li key={c.id}>
              <button type="button" aria-expanded={isOpen} aria-controls={`crop-${c.id}`} onClick={() => setOpen(isOpen ? null : c.id)} className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-start">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-content-center rounded-md border border-line bg-paper text-gold-text"><CropIcon icon={c.icon} size={20} /></span>
                  <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-serif text-base">{cropName(c.id, locale)}</span>
                    {c.nFixing && <span className="fs-chip text-muted">{t("nfixShort")}</span>}
                  </span>
                  <span className="block truncate text-xs italic text-muted" lang="la">{c.scientific}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {fit && fitLabel && <FitMeter score={fit.score} label={fitLabel} />}
                  <span className="fs-tag hidden sm:inline">{fam(c.family)}</span>
                  <Icon name="chevron" size={16} className={`text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div id={`crop-${c.id}`} className="fs-rise pb-5">
                  {fit && (
                    <div className="mb-4 rounded-lg border border-line bg-paper p-3">
                      <p className="fs-eyebrow">{t("fitHere")}</p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <strong className="tnum font-serif text-2xl">{n(fit.score, 0)}<span className="ms-1 font-sans text-xs text-muted">/100</span></strong>
                        <span className="text-muted">{fitLabel}</span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {irrigated ? t("fitBestIrrigated", { month: monthName(fit.month), climate: n(fit.climate, 0) }) : t("fitBest", { month: monthName(fit.month), climate: n(fit.climate, 0), water: n(fit.water, 0) })}
                      </p>
                      {windows && (
                        <div className="mt-3">
                          <p className="text-xs text-muted">{t("windows")}</p>
                          <ol className="mt-1 grid grid-cols-12 gap-1" aria-label={t("windows")}>
                            {windows.map((f, m) => (
                              <li key={m} className="text-center" title={`${monthName(m)}: ${t(`window.${f}`)}`}>
                                <span className={`block h-3 rounded-[3px] ${FIT_CLASS[f]}`} aria-hidden="true" />
                                <span className="mt-1 block font-mono text-[10px] text-muted" aria-hidden="true">{monthName(m, "narrow")}</span>
                                <span className="sr-only">{monthName(m)}: {t(`window.${f}`)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {([
                      [t("best"), t("range", { low: n(c.tOptLow), high: n(c.tOptHigh) })],
                      [t("tolerates"), t("range", { low: n(c.tMin), high: n(c.tMax) })],
                      [t("rain"), t("rainV", { low: n(c.rainMm.optLow, 0), high: n(c.rainMm.optHigh, 0) })],
                      [t("rainTolerates"), t("rainV", { low: n(c.rainMm.min, 0), high: n(c.rainMm.max, 0) })],
                      [t("cycle"), t("cycleV", { min: n(c.cycleDays[0], 0), max: n(c.cycleDays[1], 0), days: n(c.seasonDays, 0) })],
                      [t("kill"), c.killC === null ? t("na") : t("killV", { t: n(c.killC) })],
                      [t("residue"), t(`level.${c.residue}`)], [t("nfix"), c.nFixing ? t("yes") : t("no")],
                      [t("family"), fam(c.family)], [t("scientific"), c.scientific],
                      [t("soilBest"), c.soil.best.length ? c.soil.best.map((g) => st(`group.${g}`)).join(", ") : t("na")],
                      [t("soilTolerated"), c.soil.tolerated.length ? c.soil.tolerated.map((g) => st(`group.${g}`)).join(", ") : t("na")],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-mono text-sm" dir="auto">{v}</dd></div>
                    ))}
                  </dl>

                  <div className="mt-4 border-t border-line pt-3">
                    <p className="flex items-center gap-2 text-xs text-muted">{t("econ")}{econ && <span className="fs-tag">{t("illustrative")}</span>}</p>
                    {econ ? (
                      <dl className="mt-2 grid grid-cols-3 gap-x-4">
                        {([[t("yield"), `${n(econ.yieldTHa)} t/ha`], [t("price"), `${money(econ.priceUsdPerT)} / t`], [t("cost"), money(econ.costUsdHa)]] as const).map(([k, v]) => (
                          <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 truncate font-mono text-sm">{v}</dd></div>
                        ))}
                      </dl>
                    ) : <p className="mt-1 text-sm">{t("econNa")}</p>}
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs text-muted">{t("fertility")}</p>
                    <ul className="mt-1 list-disc space-y-1 ps-5 text-sm marker:text-line-strong">
                      {fertilityNotes(c).map((k) => <li key={k} className={k === "noDose" ? "font-medium" : ""}>{ft(k)}</li>)}
                    </ul>
                    <p className="mt-1 text-[11px] leading-snug text-muted" dir="ltr">{FERTILITY_SOURCE}</p>
                  </div>

                  <details className="mt-3 text-xs text-muted">
                    <summary className="fs-tap select-none gap-1.5"><Icon name="info" size={16} />{t("source")}</summary>
                    {/* the catalogue's own source notes, kept in their original wording */}
                    <p className="mt-1 leading-relaxed" dir="ltr">{c.source}</p>
                    {c.economicsSource && <p className="mt-1 leading-relaxed" dir="ltr">{c.economicsSource}</p>}
                    <p className="mt-1 leading-relaxed" dir="ltr">{TEXTURE_GROUP_SOURCE}</p>
                  </details>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{t("use")}</span>
                    {plan.map((_, i) => (
                      <button key={i} type="button" onClick={() => onUse(i, c.id)} aria-pressed={plan[i] === c.id} aria-label={`${t("use")} ${i + 1}`}
                        className={`fs-btn min-w-11 px-3 ${plan[i] === c.id ? "fs-btn-primary" : "fs-btn-quiet"}`}>{plan[i] === c.id && <Icon name="check" size={16} />}{i + 1}</button>
                    ))}
                    {onAdd && <button type="button" onClick={() => onAdd(c.id)} className="fs-btn fs-btn-quiet px-3"><Icon name="plus" size={16} />{t("addSeason")}</button>}
                  </div>
                  {onZones && (
                    <button type="button" onClick={() => onZones(c.id)} aria-pressed={zoneCrop === c.id} className={`fs-btn mt-2 px-3 ${zoneCrop === c.id ? "fs-btn-primary" : "fs-btn-quiet"}`}>
                      <Icon name="map" size={16} />{zoneCrop === c.id ? t("zonesHide") : t("zonesShow")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {hits.length === 0 && <li className="py-4 text-muted">{t("none")}</li>}
      </ul>
      <p className="mt-4 rounded-lg border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">{t("about", { count: CROPS.length, priced: PRICED })}</p>
    </div>
  );
}
