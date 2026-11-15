import type { Crop } from "@/lib/rotation/types";

/**
 * Fertility guidance without doses. FieldShift never gives fertiliser rates or product names (project rule):
 * these are general nutrient-management principles, chosen by crop type. The wording lives in messages/*.json (fertility.*).
 */
export type FertilityNote = "soilTest" | "legume" | "nitrogen" | "potassium" | "sulfur" | "calcium" | "organic" | "fourR" | "noDose";

export const FERTILITY_SOURCE =
  "General nutrient-management principles. References: FAO (2006) Plant nutrition for food security, Fertilizer and Plant Nutrition Bulletin 16; IPNI (2012) 4R Plant Nutrition Manual. No rates: those need a soil test and local advice.";

const ROOTS = new Set(["potato", "sweetPotato", "cassava", "sugarBeet", "carrot"]);
const FRUITING_NIGHTSHADES = new Set(["tomato", "pepper", "chilli", "eggplant"]);

export function fertilityNotes(c: Crop): FertilityNote[] {
  const notes: FertilityNote[] = ["soilTest"];
  if (c.nFixing) notes.push("legume");
  else if (c.family === "cereal" || c.family === "forage") notes.push("nitrogen");
  if (ROOTS.has(c.id)) notes.push("potassium");
  if (c.family === "brassica") notes.push("sulfur");
  if (FRUITING_NIGHTSHADES.has(c.id)) notes.push("calcium");
  notes.push("organic", "fourR", "noDose");
  return notes;
}
