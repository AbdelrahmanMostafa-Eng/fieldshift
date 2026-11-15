/**
 * Small reference values that are not crop data: area units, season rules, soil texture classes.
 * Every number and every classification carries its source.
 */

export interface AreaUnit { id: "ha" | "acre" | "feddan"; ha: number; source: string }
/** Hectares in one unit. */
export const AREA_UNITS: AreaUnit[] = [
  { id: "ha", ha: 1, source: "SI: 1 hectare = 10,000 m²." },
  { id: "acre", ha: 0.40468564224, source: "International yard and pound agreement (1959): 1 acre = 4,046.8564224 m²." },
  { id: "feddan", ha: 0.42, source: "FAO AQUASTAT country profile for Egypt: 1 feddan = 0.42 ha." },
];

export const SEASON_RULES = {
  /** A month is "warm" or "cool" when its mean is this far above or below the place's own yearly mean. */
  tempDeltaC: { value: 2, source: "FieldShift display rule for describing a place's own year. Not an agronomic standard." },
  /** A month with at least this much rain is called "wet", otherwise "dry". */
  /** A month "has frost" in a year when its lowest air temperature falls below this. */
  frostC: { value: 0, source: "ETCCDI climate index FD (frost days): daily minimum air temperature below 0 °C. Applied here to NASA POWER's monthly lowest 2 m temperature (T2M_MIN)." },
  wetMonthMm: { value: 60, source: "Köppen-Geiger classification: under 60 mm in a month is a dry month in tropical climates (Peel, Finlayson and McMahon 2007, Hydrol. Earth Syst. Sci. 11, 1633-1644)." },
} as const;

export type Level3 = "low" | "medium" | "high";
export interface TextureClass {
  id: string;
  /** Typical colour for the triangle. Purely a drawing choice. */
  tint: string;
  /** How fast water drains through, how much plant-usable water it holds, how hard it is to work. Qualitative. */
  drainage: Level3; waterHolding: Level3; effort: Level3;
  source: string;
}

const TEXTURE_SOURCE =
  "Class limits: USDA Soil Survey Manual (Handbook 18), chapter 3, soil texture classes. Behaviour: general summary of USDA NRCS Soil Quality Indicators sheets (Available Water Capacity; Infiltration, 2008). Qualitative only: no measured numbers for your field.";

/** The 12 USDA soil texture classes. */
export const TEXTURE_CLASSES: TextureClass[] = [
  { id: "sand", tint: "#e3c988", drainage: "high", waterHolding: "low", effort: "low", source: TEXTURE_SOURCE },
  { id: "loamySand", tint: "#d8b976", drainage: "high", waterHolding: "low", effort: "low", source: TEXTURE_SOURCE },
  { id: "sandyLoam", tint: "#c9a565", drainage: "high", waterHolding: "medium", effort: "low", source: TEXTURE_SOURCE },
  { id: "loam", tint: "#a98454", drainage: "medium", waterHolding: "high", effort: "low", source: TEXTURE_SOURCE },
  { id: "siltLoam", tint: "#b9a488", drainage: "medium", waterHolding: "high", effort: "medium", source: TEXTURE_SOURCE },
  { id: "silt", tint: "#cfc3ad", drainage: "medium", waterHolding: "high", effort: "medium", source: TEXTURE_SOURCE },
  { id: "sandyClayLoam", tint: "#b0744a", drainage: "medium", waterHolding: "medium", effort: "medium", source: TEXTURE_SOURCE },
  { id: "clayLoam", tint: "#946246", drainage: "low", waterHolding: "high", effort: "medium", source: TEXTURE_SOURCE },
  { id: "siltyClayLoam", tint: "#8c7566", drainage: "low", waterHolding: "high", effort: "medium", source: TEXTURE_SOURCE },
  { id: "sandyClay", tint: "#9a5236", drainage: "low", waterHolding: "medium", effort: "high", source: TEXTURE_SOURCE },
  { id: "siltyClay", tint: "#7a5a50", drainage: "low", waterHolding: "medium", effort: "high", source: TEXTURE_SOURCE },
  { id: "clay", tint: "#6e3f30", drainage: "low", waterHolding: "medium", effort: "high", source: TEXTURE_SOURCE },
];
