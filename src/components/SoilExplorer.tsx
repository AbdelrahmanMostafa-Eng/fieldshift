"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { TEXTURE_CLASSES, TEXTURE_GROUP, TEXTURE_GROUP_SOURCE, type Level3 } from "@/data/reference";
import { CropIcon } from "./ui/CropIcon";
import { textureClass } from "@/lib/farm";
import { Range } from "./ui/Range";

const STEP = 5, W = 320, H = (W * Math.sqrt(3)) / 2, PAD = 26;
const LEVEL: Record<Level3, number> = { low: 1, medium: 2, high: 3 };
const TINT = new Map(TEXTURE_CLASSES.map((c) => [c.id, c.tint]));
/** Triangle position: clay rises to the top corner, sand sits at the left corner, silt at the right. */
const point = (sand: number, clay: number) => ({ x: PAD + ((100 - sand - clay) + clay / 2) / 100 * W, y: PAD + H * (1 - clay / 100) });

function Meter({ label, level, word }: { label: string; level: Level3; word: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="flex gap-1" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i <= LEVEL[level] ? "bg-gold" : "bg-line-strong"}`} />)}</span>
        <span>{word}</span>
      </dd>
    </div>
  );
}

/**
 * The 12 USDA texture classes on a tappable texture triangle, with sliders for the same two numbers.
 * General guidance only. It never changes the scores: a self-reported class is not a soil test.
 */
export function SoilExplorer({ onUse }: { onUse?: (id: string) => void }) {
  const t = useTranslations("soil");
  const locale = useLocale();
  const [mix, setMix] = useState({ sand: 40, clay: 20 });
  const silt = 100 - mix.sand - mix.clay;
  const id = textureClass(mix.sand, mix.clay) ?? "loam";
  const info = TEXTURE_CLASSES.find((c) => c.id === id) ?? TEXTURE_CLASSES[3];
  const pct = (v: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(v / 100);
  const dots = useMemo(() => {
    const out: { sand: number; clay: number; cls: string }[] = [];
    for (let clay = 0; clay <= 100; clay += STEP) for (let sand = 0; sand <= 100 - clay; sand += STEP) out.push({ sand, clay, cls: textureClass(sand, clay) ?? "clay" });
    return out;
  }, []);
  const here = point(mix.sand, mix.clay);
  const group = TEXTURE_GROUP[id] ?? "medium";
  const collator = useMemo(() => new Intl.Collator(locale), [locale]);
  const suited = useMemo(() => CROPS.filter((c) => c.soil.best.includes(group)).sort((a, b) => collator.compare(cropName(a.id, locale), cropName(b.id, locale))), [group, collator, locale]);
  const tolerated = useMemo(() => CROPS.filter((c) => !c.soil.best.includes(group) && c.soil.tolerated.includes(group)).length, [group]);

  return (
    <div className="mt-5 text-sm">
      <p className="fs-eyebrow">{t("title")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("intro")}</p>

      <svg viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`} role="img" aria-label={`${t("title")}: ${t(`class.${id}`)}`} direction="ltr" className="mx-auto mt-3 block h-auto w-full max-w-sm touch-manipulation">
        {dots.map((d) => {
          const p = point(d.sand, d.clay), on = d.cls === id;
          return <circle key={`${d.sand}-${d.clay}`} cx={p.x} cy={p.y} r={on ? 6.6 : 5.6} fill={TINT.get(d.cls)} opacity={on ? 1 : 0.42} className="cursor-pointer" onClick={() => setMix({ sand: d.sand, clay: d.clay })} />;
        })}
        <circle cx={here.x} cy={here.y} r="9.5" fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
        <text x={PAD + W / 2} y={14} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">{t("clay")}</text>
        <text x={PAD - 4} y={H + PAD * 2 - 4} textAnchor="start" className="fill-[var(--muted)] text-[11px]">{t("sand")}</text>
        <text x={W + PAD + 4} y={H + PAD * 2 - 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">{t("silt")}</text>
      </svg>

      <div className="mt-2 space-y-1">
        <label className="flex items-center gap-3"><span className="w-12 shrink-0 text-muted">{t("clay")}</span>
          <Range min={0} max={100} step={STEP} value={mix.clay} bubble={pct(mix.clay)} onChange={(clay) => setMix((m) => ({ clay, sand: Math.min(m.sand, 100 - clay) }))} />
          <span className="w-10 shrink-0 text-end font-mono text-xs">{pct(mix.clay)}</span></label>
        <label className="flex items-center gap-3"><span className="w-12 shrink-0 text-muted">{t("sand")}</span>
          <Range min={0} max={100} step={STEP} value={mix.sand} bubble={pct(mix.sand)} onChange={(sand) => setMix((m) => ({ sand, clay: Math.min(m.clay, 100 - sand) }))} />
          <span className="w-10 shrink-0 text-end font-mono text-xs">{pct(mix.sand)}</span></label>
        <p className="flex items-center gap-3 py-1"><span className="w-12 shrink-0 text-muted">{t("silt")}</span><span className="font-mono text-xs">{pct(silt)}</span></p>
      </div>

      <section className="mt-4 border-t border-line pt-5" aria-live="polite">
        <p className="flex items-center gap-3"><span className="h-6 w-6 rounded-full border border-line" style={{ background: info.tint }} /><span className="font-serif text-2xl">{t(`class.${id}`)}</span></p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Meter label={t("drainage")} level={info.drainage} word={t(`speed.${info.drainage}`)} />
          <Meter label={t("waterHolding")} level={info.waterHolding} word={t(`level.${info.waterHolding}`)} />
          <Meter label={t("effort")} level={info.effort} word={t(`level.${info.effort}`)} />
        </dl>
        <p className="mt-4 text-sm leading-relaxed">{t(`advice.${info.drainage}`)}</p>
        <div className="mt-5 border-t border-line pt-4">
          <p className="fs-eyebrow">{t("suited", { group: t(`group.${group}`) })}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suited.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={onUse ? () => onUse(c.id) : undefined} disabled={!onUse} title={onUse ? t("addToPlan") : undefined} className="fs-chip inline-flex items-center gap-1.5 disabled:cursor-default">
                  <CropIcon icon={c.icon} size={16} className="text-gold-text" />{cropName(c.id, locale)}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t("suitedCount", { best: suited.length, tolerated })}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{TEXTURE_GROUP_SOURCE}</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{t("note")}</p>
        {/* the source note stays in its original wording */}
        <p className="mt-2 text-xs leading-relaxed text-muted" dir="auto"><span className="fs-tag">{t("source")}</span> {info.source}</p>
      </section>
    </div>
  );
}
