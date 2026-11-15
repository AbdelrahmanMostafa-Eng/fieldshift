export type Family =
  | "cereal" | "legume" | "brassica" | "solanum" | "root" | "oilseed" | "cucurbit" | "forage" | "allium" | "mallow" | "amaranth";

export interface Crop {
  id: string;
  name: string;
  /** Scientific name and FAO EcoPort record the agronomy comes from. */
  scientific: string;
  ecoPort: number;
  family: Family;
  nFixing: boolean;
  residue: "low" | "medium" | "high";
  /** Rain over the crop cycle (mm) at which the crop is no longer short of water: EcoCrop's lowest optimal rainfall. */
  waterNeedMm: number;
  rainMm: { min: number; optLow: number; optHigh: number; max: number };
  tMin: number; tOptLow: number; tOptHigh: number; tMax: number; // °C, compared with monthly mean temperature
  /** EcoCrop killing temperature (°C), null when the record has none. */
  killC: number | null;
  /** EcoCrop crop cycle, shortest to longest, in days. */
  cycleDays: [number, number];
  /** Days used by the engine: the midpoint of cycleDays. */
  seasonDays: number;
  /** Economics per hectare. null = not available in the catalogue (the farmer can enter their own). */
  yieldTHa: number | null;
  priceUsdPerT: number | null;
  costUsdHa: number | null;
  /** Extra names the assistant recognises (other languages, synonyms). Lowercase. */
  aliases?: string[];
  /** Display names by locale. */
  names?: Record<string, string>;
  /** Every coefficient must say where it came from. */
  source: string;
  economicsSource: string | null;
}

/** years × 12 months. null = missing in the source. */
export type Monthly = (number | null)[][];

export interface ClimateSeries {
  years: number[];
  T2M: Monthly;                // °C
  /** Lowest 2 m air temperature of each month (°C). Absent in older cached series. */
  T2M_MIN?: Monthly;
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
  /** null when a crop in the sequence has no yield or price in the catalogue. */
  netUsdHa3yr: number | null;
  why: string[];
  evidence: string[];
  gaps: string[];
  risks: string[];
}
