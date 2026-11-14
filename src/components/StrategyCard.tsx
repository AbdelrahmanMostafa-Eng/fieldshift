"use client";
import { useLocale, useTranslations } from "next-intl";
import { cropName } from "@/data/crops";
import type { Confidence, Strategy } from "@/lib/rotation/types";
import { Icon } from "./ui/Icon";
import { useCountUp } from "./ui/hooks";

const BARS = ["soil", "water", "climate", "economics", "risk"] as const;
const LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/** Three small bars, one to three filled. The word is always shown too: the meter never stands alone. */
export function ConfidenceMeter({ level, label }: { level: Confidence; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs" title={label}>
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((i) => <span key={i} className={`w-1.5 rounded-[2px] ${i <= LEVEL[level] ? "bg-gold" : "bg-line-strong"}`} style={{ height: 5 + i * 3 }} />)}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

/**
 * One strategy as a ledger entry: number, name, crops in order, the score with its likely range,
 * the five part-scores, the three-year return, then the reasoning.
 * The score is a middle value with a range, never a promise.
 */
export function StrategyCard({ s, index, top, money }: { s: Strategy; index: number; top: boolean; money: (usd: number) => string }) {
  const t = useTranslations("results");
  const p = useTranslations("plan");
  const locale = useLocale();
  const n0 = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  const net = useCountUp(s.netUsdHa3yr);
  const rangeText = `${t("range")}: ${n0(s.band.p10)}–${n0(s.band.p90)}`;

  return (
    <article className={`fs-rise relative py-5 ${top ? "ps-4" : ""}`} style={{ ["--i" as string]: index }}>
      {top && <span className="absolute inset-y-5 start-0 w-[3px] rounded-full bg-gold" aria-hidden="true" />}
      <header className="flex items-start gap-3">
        <span className="pt-1 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-serif text-lg leading-tight">{s.label}</h3>
            {top && <span className="fs-chip border-gold/50 bg-gold/15 font-medium">{t("top")}</span>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {s.sequence.map((id, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <Icon name="arrow" size={12} className="text-muted" />}
                <span className="fs-chip">{cropName(id, locale)}</span>
              </span>
            ))}
          </p>
        </div>
      </header>

      <div className="mt-4 flex items-end gap-4">
        <p className="shrink-0 leading-none">
          <span className="block text-[11px] text-muted">{t("score")}</span>
          <span className="tnum mt-1 block font-serif text-4xl">{n0(s.band.p50)}<span className="ms-1 font-sans text-xs text-muted">/100</span></span>
        </p>
        <div className="min-w-0 flex-1 pb-1">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-muted">
            <span className="truncate">{t("range")}</span><span className="font-mono text-ink" dir="ltr">{n0(s.band.p10)}–{n0(s.band.p90)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-line" role="img" aria-label={`${rangeText}. ${t("score")}: ${n0(s.band.p50)}`}>
            <div className="absolute inset-y-0 rounded-full bg-gold/45" style={{ insetInlineStart: pct(s.band.p10), width: pct(s.band.p90 - s.band.p10) }} />
            <div className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded bg-gold rtl:translate-x-1/2" style={{ insetInlineStart: pct(s.band.p50) }} />
          </div>
          <p className="mt-2"><ConfidenceMeter level={s.confidence} label={`${t("confidence")}: ${t(s.confidence)}`} /></p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-5 gap-2 text-[11px] text-muted">
        {BARS.map((k) => (
          <div key={k} className="min-w-0">
            <dt className="truncate" title={p(k)}>{p(k)}</dt>
            <dd className="mt-1 font-mono text-sm text-ink">{n0(s.scores[k])}</dd>
            <dd className="mt-1 h-1 rounded-full bg-line" aria-hidden="true"><span className="block h-full rounded-full bg-ink/45" style={{ width: pct(s.scores[k]) }} /></dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="text-muted">{t("net")}</span>
        <strong className="tnum font-mono text-base">{money(net)}</strong>
        <span className="text-muted">{t("perHa")}</span>
        <span className="fs-tag">{t("illustrative")}</span>
      </p>

      <details className="mt-3 text-sm">
        <summary className="fs-tap select-none gap-1.5 text-muted transition-colors hover:text-ink">
          <Icon name="chevron" size={16} className="fs-caret" />{t("why")} · {t("evidence")} · {t("gaps")}
        </summary>
        {([["why", s.why], ["evidence", s.evidence], ["gaps", s.gaps], ["risks", s.risks]] as const).map(([k, items]) => (
          <div key={k} className="mt-2 first-of-type:mt-0">
            <h4 className="fs-eyebrow">{t(k)}</h4>
            {/* the engine writes these sentences in English for now */}
            <ul dir="auto" className="mt-1 list-disc space-y-1 ps-5 marker:text-line-strong">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </details>
    </article>
  );
}

/** Same outline as a strategy entry, shown while climate data loads, so nothing jumps when results arrive. */
export function StrategySkeleton() {
  return (
    <div className="py-5" aria-hidden="true">
      <div className="fs-skel h-5 w-2/5" />
      <div className="mt-3 flex gap-2"><div className="fs-skel h-6 w-16 rounded-full" /><div className="fs-skel h-6 w-16 rounded-full" /><div className="fs-skel h-6 w-16 rounded-full" /></div>
      <div className="mt-4 flex items-end gap-4"><div className="fs-skel h-12 w-16" /><div className="fs-skel h-2 flex-1 rounded-full" /></div>
      <div className="mt-4 grid grid-cols-5 gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="fs-skel h-9" />)}</div>
      <div className="fs-skel mt-4 h-4 w-3/5" />
    </div>
  );
}
