import { economics } from "@/lib/roi";
import type {
  ClimateSeries, Confidence, Crop, EngineInput, Monthly, Scores, Strategy, Weights,
} from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const mean = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : NaN; };
const std = (a: ArrayLike<number>) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return Math.sqrt(s / (a.length - 1));
};
export function percentile(sorted: ArrayLike<number>, p: number): number {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Shortest and longest plan the engine accepts, in seasons (one crop per year). */
export const MIN_SEASONS = 1;
export const MAX_SEASONS = 5;

export const monthsFor = (startMonth: number, seasonDays: number) =>
  Array.from({ length: Math.max(1, Math.round(seasonDays / 30.4)) }, (_, i) => (startMonth + i) % 12);

function cell(series: Monthly, yearIdx: number, month: number): number | null {
  return series[yearIdx]?.[month] ?? null;
}

/**
 * Soil score: legumes, residue and family diversity help; repeating a family hurts.
 * The per-crop terms are scaled to a three-season plan, so plans of different lengths score on the same scale.
 */
export function soilScore(seq: Crop[], history: Crop[]): number {
  if (!seq.length) return 50;
  const h = history.length, h1 = history[h - 1], h2 = history[h - 2];
  let terms = 0;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (c.nFixing) terms += 12;
    terms += c.residue === "high" ? 6 : c.residue === "medium" ? 3 : 0;
    const prev = i === 0 ? h1 : seq[i - 1];
    if (prev && prev.family === c.family) { terms -= 15; continue; }
    // the same family earlier in the window (last two past crops and this plan so far), but not right before
    let seen = h1?.family === c.family || h2?.family === c.family;
    for (let j = 0; j < i && !seen; j++) seen = seq[j].family === c.family;
    if (seen) terms -= 5;
  }
  let s = 50 + (terms * 3) / seq.length;
  const families = new Set<string>();
  if (h2) families.add(h2.family);
  if (h1) families.add(h1.family);
  for (const c of seq) families.add(c.family);
  if (families.size >= 4) s += 8;
  return clamp(s);
}

/** Value at percentile p of the first `len` numbers in `a`, by selection (reorders `a`). Same result as sorting first. */
export function selectPercentile(a: Float64Array, len: number, p: number): number {
  const idx = (len - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
  const kth = (k: number) => {
    let l = 0, r = len - 1;
    while (l < r) {
      const pivot = a[(l + r) >> 1];
      let i = l, j = r;
      while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
      }
      if (k <= j) r = j; else if (k >= i) l = i; else break;
    }
    return a[k];
  };
  const vHi = kth(hi);
  if (lo === hi) return vHi;
  let vLo = -Infinity;
  for (let i = 0; i < hi; i++) if (a[i] > vLo) vLo = a[i];
  return vLo + (vHi - vLo) * (idx - lo);
}

/** One crop's water score for one past year, before averaging and clamping (it can go below zero in a very dry year). */
function cropWaterRaw(crop: Crop, c: ClimateSeries, yi: number, start: number, irrigated: boolean): number {
  const rain = monthsFor(start, crop.seasonDays).reduce((s, m) => s + (cell(c.PRECTOTCORR, yi, m) ?? 0) * 30.4, 0);
  const deficit = Math.max(0, crop.waterNeedMm - rain) / crop.waterNeedMm;
  return 100 * (1 - (irrigated ? 0.6 : 1) * deficit);
}
/** One crop's temperature fit for one past year: 100 when every month of its season is in the best range. */
function cropClimateRaw(crop: Crop, c: ClimateSeries, yi: number, start: number): number {
  const fit = monthsFor(start, crop.seasonDays).map((m) => {
    const t = cell(c.T2M, yi, m);
    if (t === null) return 0.5; // unknown: neutral, not a pass
    if (t >= crop.tOptLow && t <= crop.tOptHigh) return 1;
    if (t < crop.tOptLow) return clamp((t - crop.tMin) / (crop.tOptLow - crop.tMin), 0, 1);
    return clamp((crop.tMax - t) / (crop.tMax - crop.tOptHigh), 0, 1);
  });
  return 100 * mean(fit);
}

export function waterScoreForYear(seq: Crop[], c: ClimateSeries, yi: number, start: number, irrigated: boolean): number {
  return clamp(mean(seq.map((crop) => cropWaterRaw(crop, c, yi, start, irrigated))));
}
export function climateScoreForYear(seq: Crop[], c: ClimateSeries, yi: number, start: number): number {
  return clamp(mean(seq.map((crop) => cropClimateRaw(crop, c, yi, start))));
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
const cropNet = (c: Priced) => economics({ yieldTHa: c.yieldTHa, priceUsdPerT: c.priceUsdPerT, costUsdHa: c.costUsdHa }).net;

/** Net per hectare over all seasons, or null when any crop has no yield, price or cost in the catalogue. */
export function netUsdHa(seq: Crop[]): number | null {
  if (!seq.every(hasEconomics)) return null;
  return seq.reduce((s, c) => s + cropNet(c), 0);
}

/** "What matters most": three levels instead of a 0-10 slider. The weights are relative, so only their ratio counts. */
export type Importance = "low" | "medium" | "high";
export const IMPORTANCE_WEIGHT: Record<Importance, number> = { low: 1, medium: 3, high: 6 };
export const weightsFrom = (p: Record<keyof Weights, Importance>): Weights => ({
  soil: IMPORTANCE_WEIGHT[p.soil], water: IMPORTANCE_WEIGHT[p.water], climate: IMPORTANCE_WEIGHT[p.climate],
  economics: IMPORTANCE_WEIGHT[p.economics], risk: IMPORTANCE_WEIGHT[p.risk],
});

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

/** Per-crop, per-year scores, computed once and reused by every sequence that contains the crop. */
type CropYears = Map<string, { water: Float64Array; climate: Float64Array }>;
function cropYears(crops: Crop[], input: EngineInput): CropYears {
  const n = input.climate.years.length;
  const out: CropYears = new Map();
  for (const crop of crops) {
    if (out.has(crop.id)) continue;
    const water = new Float64Array(n), climate = new Float64Array(n);
    for (let yi = 0; yi < n; yi++) {
      water[yi] = cropWaterRaw(crop, input.climate, yi, input.startMonth, input.irrigated);
      climate[yi] = cropClimateRaw(crop, input.climate, yi, input.startMonth);
    }
    out.set(crop.id, { water, climate });
  }
  return out;
}

function evaluate(seq: Crop[], history: Crop[], years: CropYears, n: number, econNorm: (net: number | null) => number): Evaluated {
  const water: number[] = [], climate: number[] = [];
  for (let yi = 0; yi < n; yi++) {
    let w = 0, c = 0;
    for (const crop of seq) { const cy = years.get(crop.id)!; w += cy.water[yi]; c += cy.climate[yi]; }
    water.push(clamp(w / seq.length)); climate.push(clamp(c / seq.length));
  }
  const net = netUsdHa(seq);
  return { seq, soil: soilScore(seq, history), econ: econNorm(net), water, climate, net };
}

function summarize(e: Evaluated, weights: Weights, input: EngineInput) {
  const w = normalize(weights);
  const combined = e.water.map((v, i) => (v + e.climate[i]) / 2);
  const risk = clamp(100 - 2 * std(combined)); // high = stable across seasons
  const perYear = Float64Array.from(e.water, (wat, i) =>
    w.soil * e.soil + w.water * wat + w.climate * e.climate[i] + w.economics * e.econ + w.risk * risk);
  const sorted = perYear.sort();
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
  const medWater = percentile([...e.water].sort((a, b) => a - b), 0.5);
  const legumes = [...new Set(e.seq.filter((c) => c.nFixing).map((c) => c.name))];
  const why: string[] = [];
  if (legumes.length) why.push(`Includes nitrogen-fixing ${legumes.join(", ")} (catalog flag), which supports soil nitrogen.`);
  const prev = history[history.length - 1];
  if (prev && e.seq[0].family !== prev.family) why.push(`Breaks the ${prev.family} run: ${e.seq[0].name} follows ${prev.name}.`);
  if (!why.length) why.push(`${label}: no standout soil benefit in the catalog data.`);
  const unpriced = [...new Set(e.seq.filter((c) => !hasEconomics(c)).map((c) => c.name))];
  const span = `${e.seq.length}-season`;
  const evidence = [
    `Median water score ${medWater.toFixed(0)}/100 across ${yrs.length} seasons (${yrs[0]}–${yrs[yrs.length - 1]}) of NASA POWER monthly rain, against FAO EcoCrop rainfall needs.`,
    "Climate fit compares NASA POWER monthly temperatures with each crop's FAO EcoCrop temperature limits.",
    `Soil score ${e.soil.toFixed(0)}/100 from family diversity, residue and legume flags (heuristic, not a measurement).`,
    e.net === null
      ? `${span[0].toUpperCase()}${span.slice(1)} net return not available: the catalogue has no yield or price for ${unpriced.join(", ")}.`
      : `${span[0].toUpperCase()}${span.slice(1)} net return about $${Math.round(e.net).toLocaleString("en-US")}/ha at the catalog's illustrative yields and prices.`,
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

/** Keeps the best few sequences for one weighting while scanning, without storing every candidate. */
class TopK {
  items: { score: number; idx: number[] }[] = [];
  constructor(private k: number) {}
  offer(score: number, idx: number[]) {
    if (this.items.length === this.k && score <= this.items[this.items.length - 1].score) return;
    this.items.push({ score, idx: [...idx] });
    this.items.sort((a, b) => b.score - a.score);
    if (this.items.length > this.k) this.items.pop();
  }
}

export function recommend(input: EngineInput): Strategy[] {
  const byId = new Map(input.catalog.map((c) => [c.id, c]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is Crop => !!c);
  const history = resolve(input.history);
  const current = resolve(input.current).slice(0, MAX_SEASONS);
  const seasons = Math.min(MAX_SEASONS, Math.max(MIN_SEASONS, current.length || 3));
  const n = input.climate.years.length;

  // Suggested strategies use only crops with a yield, price and cost, so each one has an income figure.
  // Any crop can still be in the farmer's own plan.
  const pool = input.catalog.filter(hasEconomics);
  const years = cropYears([...pool, ...current], input);
  // Repeating one crop gives the lowest and highest possible totals, so the income scale is known up front.
  const nets = pool.map(cropNet);
  const lo = seasons * Math.min(...nets), hi = seasons * Math.max(...nets);
  const econNorm = (net: number | null) => (net === null || !(hi > lo) ? 50 : clamp(((net - lo) / (hi - lo)) * 100));

  const key = (seq: Crop[]) => seq.map((c) => c.id).join(">");
  const used = new Set<string>();
  const out: Strategy[] = [];
  const push = (id: Strategy["id"], label: string, e: Evaluated, weights: Weights) => {
    used.add(key(e.seq));
    const s = summarize(e, weights, input);
    out.push({ id, label, sequence: e.seq.map((c) => c.id), ...s, netUsdHa: e.net, ...explain(e, history, input, label) });
  };

  if (current.length) push("current", "Your current plan", evaluate(current, history, years, n, econNorm), input.weights);

  // One pass over every sequence of the plan's length, keeping the top few per weighting.
  // Suggestions follow the first rule of rotation: never the same crop two seasons in a row
  // (10 priced crops: 10 × 9^(seasons-1) sequences; 65,610 for five seasons).
  const profiles = [
    ["soil", "Soil builder", PROFILES.soil],
    ["water", "Water saver", PROFILES.water],
    ["income", "Income diversified", PROFILES.income],
    ["balanced", "Balanced (your priorities)", input.weights],
  ] as const;
  const norm = profiles.map(([, , w]) => normalize(w));
  const tops = profiles.map(() => new TopK(profiles.length + 2));
  const P = pool.length;
  const cy = pool.map((c) => years.get(c.id)!);
  const cn = pool.map(cropNet);
  const water = new Float64Array(n), clim = new Float64Array(n), perYear = new Float64Array(n);
  const idx = new Array<number>(seasons).fill(0);
  const seq: Crop[] = new Array(seasons);
  const total = P ** seasons;
  for (let k = 0; k < total; k++) {
    let r = k, repeat = false;
    for (let i = seasons - 1; i >= 0; i--) { idx[i] = r % P; r = Math.floor(r / P); }
    for (let i = 1; i < seasons && !repeat; i++) repeat = idx[i] === idx[i - 1];
    if (repeat) continue;
    let net = 0;
    for (let i = 0; i < seasons; i++) { seq[i] = pool[idx[i]]; net += cn[idx[i]]; }
    // per-year water and climate, their stability (risk), then each weighting's middle year: the same maths as summarize()
    let cm = 0;
    for (let yi = 0; yi < n; yi++) {
      let w = 0, c = 0;
      for (let i = 0; i < seasons; i++) { w += cy[idx[i]].water[yi]; c += cy[idx[i]].climate[yi]; }
      water[yi] = clamp(w / seasons); clim[yi] = clamp(c / seasons); cm += (water[yi] + clim[yi]) / 2;
    }
    cm /= n;
    let ss = 0;
    for (let yi = 0; yi < n; yi++) ss += ((water[yi] + clim[yi]) / 2 - cm) ** 2;
    const risk = clamp(100 - 2 * (n > 1 ? Math.sqrt(ss / (n - 1)) : 0));
    const soil = soilScore(seq, history), econ = econNorm(net);
    for (let p = 0; p < norm.length; p++) {
      const w = norm[p];
      for (let yi = 0; yi < n; yi++) perYear[yi] = w.soil * soil + w.water * water[yi] + w.climate * clim[yi] + w.economics * econ + w.risk * risk;
      tops[p].offer(selectPercentile(perYear, n, 0.5), idx);
    }
  }
  profiles.forEach(([id, label, w], p) => {
    const pick = tops[p].items.map((t) => t.idx.map((i) => pool[i])).find((seq) => !used.has(key(seq)));
    if (pick) push(id, label, evaluate(pick, history, years, n, econNorm), id === "balanced" ? input.weights : w);
  });
  return out;
}
