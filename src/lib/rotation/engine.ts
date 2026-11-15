import { economics } from "@/lib/roi";
import type {
  ClimateSeries, Confidence, Crop, EngineInput, Monthly, Scores, Strategy, Weights,
} from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export const monthsFor = (startMonth: number, seasonDays: number) =>
  Array.from({ length: Math.max(1, Math.round(seasonDays / 30.4)) }, (_, i) => (startMonth + i) % 12);

function cell(series: Monthly, yearIdx: number, month: number): number | null {
  return series[yearIdx]?.[month] ?? null;
}

/** Soil score: legumes, residue and family diversity help; repeating a family hurts. */
export function soilScore(seq: Crop[], history: Crop[]): number {
  let s = 50;
  seq.forEach((c, i) => {
    if (c.nFixing) s += 12;
    s += c.residue === "high" ? 6 : c.residue === "medium" ? 3 : 0;
    const prev = i === 0 ? history[history.length - 1] : seq[i - 1];
    if (prev && prev.family === c.family) s -= 15;
    const window = [...history.slice(-2), ...seq.slice(0, i)];
    if (window.some((w) => w.family === c.family) && prev?.family !== c.family) s -= 5;
  });
  const families = new Set([...history.slice(-2), ...seq].map((c) => c.family));
  if (families.size >= 4) s += 8;
  return clamp(s);
}

export function waterScoreForYear(seq: Crop[], c: ClimateSeries, yi: number, start: number, irrigated: boolean): number {
  const scores = seq.map((crop) => {
    const rain = monthsFor(start, crop.seasonDays).reduce((s, m) => s + (cell(c.PRECTOTCORR, yi, m) ?? 0) * 30.4, 0);
    const deficit = Math.max(0, crop.waterNeedMm - rain) / crop.waterNeedMm;
    return 100 * (1 - (irrigated ? 0.6 : 1) * deficit);
  });
  return clamp(mean(scores));
}

export function climateScoreForYear(seq: Crop[], c: ClimateSeries, yi: number, start: number): number {
  const scores = seq.map((crop) => {
    const fit = monthsFor(start, crop.seasonDays).map((m) => {
      const t = cell(c.T2M, yi, m);
      if (t === null) return 0.5; // unknown: neutral, not a pass
      if (t >= crop.tOptLow && t <= crop.tOptHigh) return 1;
      if (t < crop.tOptLow) return clamp((t - crop.tMin) / (crop.tOptLow - crop.tMin), 0, 1);
      return clamp((crop.tMax - t) / (crop.tMax - crop.tOptHigh), 0, 1);
    });
    return 100 * mean(fit);
  });
  return clamp(mean(scores));
}

export interface PlaceFit { month: number; climate: number; water: number; score: number }

/**
 * How well one crop suits a place, for its best planting month.
 * Temperature and rain scores are averaged over the years; as in the EcoCrop model, the overall score is the
 * lower of the two (the limiting factor). Irrigated: rain is not limiting, so only temperature counts.
 * A screening guide from monthly means, not a yield forecast.
 */
export function placeFit(crop: Crop, climate: ClimateSeries, irrigated: boolean): PlaceFit | null {
  const n = climate.years.length;
  if (!n) return null;
  let best: PlaceFit | null = null;
  for (let month = 0; month < 12; month++) {
    let cs = 0, ws = 0;
    for (let yi = 0; yi < n; yi++) {
      cs += climateScoreForYear([crop], climate, yi, month);
      ws += waterScoreForYear([crop], climate, yi, month, false);
    }
    const c = cs / n, w = ws / n, score = irrigated ? c : Math.min(c, w);
    if (!best || score > best.score + 1e-9) best = { month, climate: c, water: w, score };
  }
  return best;
}

type Priced = Crop & { yieldTHa: number; priceUsdPerT: number; costUsdHa: number };
export const hasEconomics = (c: Crop): c is Priced => c.yieldTHa !== null && c.priceUsdPerT !== null && c.costUsdHa !== null;

/** Three-season net per hectare, or null when any crop has no yield, price or cost in the catalogue. */
export function netUsdHa(seq: Crop[]): number | null {
  if (!seq.every(hasEconomics)) return null;
  return seq.reduce((s, c) => s + economics({ yieldTHa: c.yieldTHa, priceUsdPerT: c.priceUsdPerT, costUsdHa: c.costUsdHa }).net, 0);
}

const PROFILES: Record<"soil" | "water" | "income" | "balanced", Weights> = {
  soil: { soil: 0.55, water: 0.1, climate: 0.15, economics: 0.05, risk: 0.15 },
  water: { soil: 0.15, water: 0.5, climate: 0.15, economics: 0.05, risk: 0.15 },
  income: { soil: 0.1, water: 0.1, climate: 0.15, economics: 0.5, risk: 0.15 },
  balanced: { soil: 0.2, water: 0.2, climate: 0.2, economics: 0.2, risk: 0.2 },
};
const normalize = (w: Weights): Weights => {
  const t = w.soil + w.water + w.climate + w.economics + w.risk || 1;
  return { soil: w.soil / t, water: w.water / t, climate: w.climate / t, economics: w.economics / t, risk: w.risk / t };
};

interface Evaluated {
  seq: Crop[]; soil: number; econ: number; water: number[]; climate: number[]; net: number | null;
}

function evaluate(seq: Crop[], history: Crop[], input: EngineInput, econNorm: (net: number | null) => number): Evaluated {
  const n = input.climate.years.length;
  const water = Array.from({ length: n }, (_, yi) => waterScoreForYear(seq, input.climate, yi, input.startMonth, input.irrigated));
  const climate = Array.from({ length: n }, (_, yi) => climateScoreForYear(seq, input.climate, yi, input.startMonth));
  const net = netUsdHa(seq);
  return { seq, soil: soilScore(seq, history), econ: econNorm(net), water, climate, net };
}

function summarize(e: Evaluated, weights: Weights, input: EngineInput) {
  const w = normalize(weights);
  const combined = e.water.map((v, i) => (v + e.climate[i]) / 2);
  const risk = clamp(100 - 2 * std(combined)); // high = stable across seasons
  const perYear = e.water.map((wat, i) =>
    w.soil * e.soil + w.water * wat + w.climate * e.climate[i] + w.economics * e.econ + w.risk * risk);
  const sorted = [...perYear].sort((a, b) => a - b);
  const band = { p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
  const scores: Scores = {
    soil: e.soil, water: mean(e.water), climate: mean(e.climate), economics: e.econ, risk, overall: band.p50,
  };
  const spread = band.p90 - band.p10;
  let confidence: Confidence = input.climate.years.length < 15 || spread > 25 ? "low" : spread > 12 ? "medium" : "high";
  if (!input.hasLocalSoil && confidence === "high") confidence = "medium"; // no soil data → never "high"
  return { scores, band, confidence };
}

function explain(e: Evaluated, history: Crop[], input: EngineInput, label: string): Pick<Strategy, "why" | "evidence" | "gaps" | "risks"> {
  const yrs = input.climate.years;
  const rainShare = e.water.map((v) => v);
  const medWater = percentile([...rainShare].sort((a, b) => a - b), 0.5);
  const legumes = e.seq.filter((c) => c.nFixing).map((c) => c.name);
  const why: string[] = [];
  if (legumes.length) why.push(`Includes nitrogen-fixing ${legumes.join(", ")} (catalog flag), which supports soil nitrogen.`);
  const prev = history[history.length - 1];
  if (prev && e.seq[0].family !== prev.family) why.push(`Breaks the ${prev.family} run: ${e.seq[0].name} follows ${prev.name}.`);
  if (!why.length) why.push(`${label}: no standout soil benefit in the catalog data.`);
  const unpriced = [...new Set(e.seq.filter((c) => !hasEconomics(c)).map((c) => c.name))];
  const evidence = [
    `Median water score ${medWater.toFixed(0)}/100 across ${yrs.length} seasons (${yrs[0]}–${yrs[yrs.length - 1]}) of NASA POWER monthly rain, against FAO EcoCrop rainfall needs.`,
    "Climate fit compares NASA POWER monthly temperatures with each crop's FAO EcoCrop temperature limits.",
    `Soil score ${e.soil.toFixed(0)}/100 from family diversity, residue and legume flags (heuristic, not a measurement).`,
    e.net === null
      ? `Three-year net return not available: the catalogue has no yield or price for ${unpriced.join(", ")}.`
      : `Three-year net return about $${Math.round(e.net).toLocaleString("en-US")}/ha at the catalog's illustrative yields and prices.`,
  ];
  const gaps = [
    "Monthly means hide frost and heat spikes; no daily extremes in this version.",
    "POWER's native grid is coarse (about 0.5° × 0.625°); your field may differ.",
    "EcoCrop limits describe the species as a whole, not your variety.",
    e.net === null
      ? "Income score is set to a neutral 50 because some crops have no catalogue yield or price. Enter your own in the Costs tab."
      : "Yields, prices and costs are illustrative catalog values; price volatility is not modelled.",
  ];
  if (!input.hasLocalSoil) gaps.unshift("No local soil test supplied, so soil score uses crop traits only.");
  const risks = [
    "Check pest and disease pressure with a local agronomist.",
    "Confirm market access and contract prices for each crop.",
    input.irrigated ? "Confirm irrigation water rights and pumping cost." : "Rain-fed plan: a dry season is the main yield risk.",
  ];
  return { why, evidence, gaps, risks };
}

export function recommend(input: EngineInput): Strategy[] {
  const byId = new Map(input.catalog.map((c) => [c.id, c]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is Crop => !!c);
  const history = resolve(input.history);
  const current = resolve(input.current);

  // Suggested strategies use only crops with a yield, price and cost, so each one has an income figure.
  // Any crop can still be in the farmer's own plan. 10 priced crops → 1,000 sequences.
  const pool = input.catalog.filter(hasEconomics);
  const all: Crop[][] = [];
  for (const a of pool) for (const b of pool) for (const c of pool) all.push([a, b, c]);
  const nets = all.map(netUsdHa).filter((v): v is number => v !== null);
  const lo = Math.min(...nets), hi = Math.max(...nets);
  const econNorm = (net: number | null) => (net === null || !(hi > lo) ? 50 : clamp(((net - lo) / (hi - lo)) * 100));
  const evaluated = all.map((seq) => evaluate(seq, history, input, econNorm));

  const key = (seq: Crop[]) => seq.map((c) => c.id).join(">");
  const used = new Set<string>();
  const out: Strategy[] = [];

  const push = (id: Strategy["id"], label: string, e: Evaluated, weights: Weights) => {
    used.add(key(e.seq));
    const s = summarize(e, weights, input);
    out.push({ id, label, sequence: e.seq.map((c) => c.id), ...s, netUsdHa3yr: e.net, ...explain(e, history, input, label) });
  };

  if (current.length === 3) push("current", "Your current plan", evaluate(current, history, input, econNorm), input.weights);

  const best = (weights: Weights) => {
    let top: Evaluated | undefined, topScore = -Infinity;
    for (const e of evaluated) {
      if (used.has(key(e.seq))) continue;
      const sc = summarize(e, weights, input).scores.overall;
      if (sc > topScore) { top = e; topScore = sc; }
    }
    return top;
  };

  (
    [
      ["soil", "Soil builder", PROFILES.soil],
      ["water", "Water saver", PROFILES.water],
      ["income", "Income diversified", PROFILES.income],
      ["balanced", "Balanced (your priorities)", input.weights],
    ] as const
  ).forEach(([id, label, w]) => {
    const e = best(w);
    if (e) push(id, label, e, id === "balanced" ? input.weights : w);
  });
  return out;
}
