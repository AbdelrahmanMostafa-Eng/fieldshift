"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROP_BY_ID, cropName } from "@/data/crops";
import { AREA_UNITS } from "@/data/reference";
import { COST_LINES, areaUnit, budgetReady, budgetResult, defaultBudget, rollup, sensitivity, toHectares, totalCostUsdHa, type CropBudget } from "@/lib/farm";
import type { Rates } from "@/lib/roi";
import { Segmented } from "./ui/Segmented";

const STORE = "fieldshift.costs.v1";
interface Saved { budgets: Record<string, CropBudget>; area: number; unit: string }

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Saved> | null;
    if (raw && typeof raw === "object") return { budgets: raw.budgets ?? {}, area: Number(raw.area) > 0 ? Number(raw.area) : 1, unit: areaUnit(String(raw.unit)).id };
  } catch { /* private mode or damaged entry: start fresh */ }
  return { budgets: {}, area: 1, unit: "ha" };
}

/** One labelled number box. Empty or negative input counts as zero in the sums. */
function Num({ label, value, onChange, step = "any" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="block min-w-0">
      <span className="block truncate text-xs text-muted" title={label}>{label}</span>
      <input type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className="fs-field tnum mt-1 w-full font-mono text-sm" dir="ltr" />
    </label>
  );
}

/**
 * Editable costs and return for the three planned seasons, in the chosen currency.
 * Money is stored in US dollars per hectare and converted for display. Everything stays on this device.
 */
export function CostTracker({ plan, currency, rates, money }: { plan: string[]; currency: string; rates: Rates; money: (usd: number) => string }) {
  const t = useTranslations("costs");
  const locale = useLocale();
  const [saved, setSaved] = useState<Saved>(load);
  const [slot, setSlot] = useState(0);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* storage full or blocked */ } }, [saved]);

  const rate = currency === "USD" ? 1 : rates[currency] ?? 1; // units of the chosen currency per US dollar
  const show = (usd: number) => (Number.isFinite(usd) ? Math.round(usd * rate * 100) / 100 : Number.NaN);
  const budgetOf = (id: string): CropBudget => saved.budgets[id] ?? defaultBudget(CROP_BY_ID.get(id) ?? CROP_BY_ID.values().next().value!);
  const cropId = plan[slot] ?? plan[0];
  const b = budgetOf(cropId);
  const patch = (p: Partial<CropBudget>) => setSaved((s) => ({ ...s, budgets: { ...s.budgets, [cropId]: { ...budgetOf(cropId), ...p } } }));
  const areaHa = toHectares(saved.area, saved.unit);
  const r = budgetResult(b, areaHa);
  const grid = sensitivity(b, areaHa);
  const all = rollup(plan.map(budgetOf), areaHa);
  const ready = budgetReady(b), allReady = plan.every((id) => budgetReady(budgetOf(id)));
  const fromCatalogue = !saved.budgets[cropId] && CROP_BY_ID.get(cropId)?.economicsSource;
  const na = t("na");
  const n = (v: number, d = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  const pct = (v: number | null) => (v === null ? t("na") : `${n(v, 0)}%`);
  const signed = (usd: number) => <span className={usd < 0 ? "text-danger" : ""}>{money(usd)}</span>;
  const steps = ["−20%", t("same"), "+20%"];

  return (
    <div className="mt-5 space-y-6 text-sm">
      <section>
        <p className="fs-eyebrow">{t("title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t("note")} {t("saved")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-28"><Num label={t("area")} value={saved.area} onChange={(v) => setSaved((s) => ({ ...s, area: v }))} /></div>
          <Segmented label={t("area")} value={saved.unit} onChange={(u) => setSaved((s) => ({ ...s, unit: u }))} options={AREA_UNITS.map((u) => ({ value: u.id as string, label: t(`unit.${u.id}`) }))} />
        </div>
        {saved.unit !== "ha" && <p className="mt-1 text-xs text-muted" title={areaUnit(saved.unit).source}>{t("areaIs", { ha: n(areaHa, 2) })}</p>}
      </section>

      <section>
        <Segmented block label={t("title")} value={String(slot)} onChange={(v) => setSlot(Number(v))} options={plan.map((id, i) => ({ value: String(i), label: `${i + 1} · ${cropName(id, locale)}` }))} />
        {!ready && <p className="mt-3 rounded-md border border-dashed border-line-strong p-3 text-xs leading-relaxed text-muted" role="status">{t("missing")}</p>}
        {ready && fromCatalogue && <p className="mt-3 text-xs text-muted"><span className="fs-tag">{t("illustrative")}</span></p>}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Num label={t("yield")} value={b.yieldTHa} onChange={(v) => patch({ yieldTHa: v })} />
          <Num label={t("price", { currency })} value={show(b.priceUsdPerT)} onChange={(v) => patch({ priceUsdPerT: v / rate })} />
        </div>
        <p className="mt-4 text-xs text-muted">{t("perHa", { currency })}</p>
        <div className="mt-1 grid grid-cols-2 gap-3">
          {COST_LINES.map((k) => <Num key={k} label={t(`line.${k}`)} value={show(b.costs[k])} onChange={(v) => patch({ costs: { ...b.costs, [k]: v / rate } })} />)}
        </div>
        <button type="button" className="fs-btn fs-btn-quiet mt-3" onClick={() => setSaved((s) => { const next = { ...s.budgets }; delete next[cropId]; return { ...s, budgets: next }; })}>{t("reset")}</button>
      </section>

      <section className="border-t border-line pt-5" aria-live="polite">
        <p className="fs-eyebrow">{cropName(cropId, locale)} · {n(areaHa, 2)} ha</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-muted">{t("net")}</span>
          <strong className={`tnum font-serif text-3xl ${ready && r.net < 0 ? "text-danger" : ""}`}>{ready ? money(r.net) : na}</strong>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {([[t("total"), money(r.totalCost)], [t("revenue"), ready ? money(r.revenue) : na], [t("roi"), ready ? pct(r.roiPct) : na], [t("costHa"), money(totalCostUsdHa(b))],
            [t("bePrice"), !ready || r.breakEvenPrice === null ? na : `${money(r.breakEvenPrice)} ${t("perT")}`], [t("beYield"), !ready || r.breakEvenYield === null ? na : `${n(r.breakEvenYield, 2)} t/ha`]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-mono">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="border-t border-line pt-5">
        <p className="fs-eyebrow">{t("sens")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t("sensNote")}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-center font-mono text-xs">
            <thead><tr><th className="text-start font-sans font-normal text-muted">{t("yieldRow")} ↓ · {t("priceCol")} →</th>{steps.map((s) => <th key={s} className="font-normal text-muted">{s}</th>)}</tr></thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={i}><th className="text-start font-normal text-muted">{steps[i]}</th>
                  {row.map((v, j) => <td key={j} className={`rounded-sm px-1 py-2 ${i === 1 && j === 1 ? "bg-gold/20 font-semibold" : "bg-paper"}`}>{ready ? signed(v) : "–"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-line pt-5">
        <p className="fs-eyebrow">{t("three")}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
          {([[t("net"), allReady ? signed(all.net) : na], [t("roi"), allReady ? pct(all.roiPct) : na], [t("total"), money(all.totalCost)], [t("revenue"), allReady ? money(all.revenue) : na]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-mono">{v}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}
