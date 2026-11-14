"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { Icon } from "./ui/Icon";

/** The crop catalogue: search, filter by family, open a crop to read its requirements, and put it into the plan. */
export function CropLibrary({ plan, onUse, money }: { plan: string[]; onUse: (slot: number, id: string) => void; money: (usd: number) => string }) {
  const t = useTranslations("crops");
  const fam = useTranslations("family");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const families = useMemo(() => [...new Set(CROPS.map((c) => c.family))], []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CROPS.filter((c) => (family === "all" || c.family === family) && (!s || `${cropName(c.id, locale)} ${c.name} ${(c.aliases ?? []).join(" ")}`.toLowerCase().includes(s)));
  }, [q, family, locale]);
  const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v);

  return (
    <div className="mt-5 text-sm">
      <p className="fs-eyebrow">{t("title")}</p>
      <label className="relative mt-2 block">
        <Icon name="search" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="fs-field w-full ps-10 text-sm" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("family")}>
        {["all", ...families].map((f) => (
          <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)} className={`fs-chip ${family === f ? "border-gold bg-gold/20 font-medium" : ""}`}>{f === "all" ? t("all") : fam(f)}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted" aria-live="polite">{t("count", { count: hits.length })}</p>

      <ul className="mt-1 divide-y divide-line">
        {hits.map((c) => {
          const isOpen = open === c.id;
          return (
            <li key={c.id}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} className="flex min-h-[52px] w-full items-center justify-between gap-3 py-2 text-start">
                <span><span className="font-serif text-base">{cropName(c.id, locale)}</span>{c.nFixing && <span className="fs-chip ms-2 text-muted">{t("nfixShort")}</span>}</span>
                <span className="flex items-center gap-2"><span className="fs-tag">{fam(c.family)}</span><Icon name="chevron" size={16} className={`text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} /></span>
              </button>
              {isOpen && (
                <div className="fs-rise pb-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {([[t("water"), t("waterV", { mm: n(c.waterNeedMm) })], [t("days"), t("daysV", { days: n(c.seasonDays) })],
                      [t("best"), t("range", { low: n(c.tOptLow), high: n(c.tOptHigh) })], [t("tolerates"), t("range", { low: n(c.tMin), high: n(c.tMax) })],
                      [t("residue"), t(`level.${c.residue}`)], [t("nfix"), c.nFixing ? t("yes") : t("no")],
                      [t("yield"), `${n(c.yieldTHa)} t/ha`], [t("price"), `${money(c.priceUsdPerT)} / t`], [t("cost"), money(c.costUsdHa)]] as const).map(([k, v]) => (
                      <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-mono text-sm" dir="auto">{v}</dd></div>
                    ))}
                  </dl>
                  {/* the catalogue's own source note, kept in its original wording */}
                  <p className="mt-3 text-xs leading-relaxed text-muted" dir="auto"><span className="fs-tag">{t("source")}</span> {c.source}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{t("use")}</span>
                    {[0, 1, 2].map((i) => (
                      <button key={i} type="button" onClick={() => onUse(i, c.id)} aria-pressed={plan[i] === c.id}
                        className={`fs-btn min-w-11 px-3 ${plan[i] === c.id ? "fs-btn-primary" : "fs-btn-quiet"}`}>{plan[i] === c.id && <Icon name="check" size={16} />}{i + 1}</button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {hits.length === 0 && <li className="py-4 text-muted">{t("none")}</li>}
      </ul>
      <p className="mt-4 rounded-lg border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted">{t("roadmap", { count: CROPS.length })}</p>
    </div>
  );
}
