export type Family =
  | "cereal" | "legume" | "brassica" | "solanum" | "root" | "oilseed" | "cucurbit" | "forage";

export interface Crop {
  id: string;
  name: string;
  family: Family;
  nFixing: boolean;
  residue: "low" | "medium" | "high";
  waterNeedMm: number; // seasonal crop water need
  tMin: number; tOptLow: number; tOptHigh: number; tMax: number; // °C, monthly-mean thresholds
  seasonDays: number;
  yieldTHa: number;
  priceUsdPerT: number;
  costUsdHa: number;
  /** Extra names the assistant recognises (other languages, synonyms). Lowercase. */
  aliases?: string[];
  /** Every coefficient must say where it came from. */
  source: string;
}

/** years × 12 months. null = missing in the source. */
export type Monthly = (number | null)[][];

export interface ClimateSeries {
  years: number[];
  T2M: Monthly;                // °C
  PRECTOTCORR: Monthly;        // mm/day
  ALLSKY_SFC_SW_DWN: Monthly;  // MJ/m²/day (AG community)
  meta: { lat: number; lon: number; source: string; fetchedAt: string };
}

export interface Weights {
  soil: number; water: number; climate: number; economics: number; risk: number;
}

export interface EngineInput {
  climate: ClimateSeries;
  catalog: Crop[];
  history: string[];   // last crops grown, most recent last
  current: string[];   // the farmer's existing plan for the next 3 seasons
  startMonth: number;  // 0 = January; month the main crop is planted each year
  irrigated: boolean;
  hasLocalSoil: boolean;
  weights: Weights;
}

export type Confidence = "low" | "medium" | "high";

export interface Scores {
  soil: number; water: number; climate: number; economics: number; risk: number; overall: number;
}

export interface Strategy {
  id: "current" | "soil" | "water" | "income" | "balanced";
  label: string;
  sequence: string[];
  scores: Scores;
  band: { p10: number; p50: number; p90: number };
  confidence: Confidence;
  netUsdHa3yr: number;
  why: string[];
  evidence: string[];
  gaps: string[];
  risks: string[];
}
