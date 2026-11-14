export const GLOSSARY: Record<string, string> = {
  et: "Evapotranspiration (ET) is the water that leaves a field as evaporation from soil plus transpiration from plants. It is the crop's real water use, so compare it with rainfall to see if irrigation is needed. Satellites estimate it from temperature, vegetation and energy balance, not by measuring it directly.",
  ndvi: "NDVI (Normalized Difference Vegetation Index) compares near-infrared and red light reflected by plants. Healthy green canopy gives high values, bare soil gives low values. It shows crop vigour over time but can saturate in dense canopy and does not say why a field is stressed.",
  "soil moisture anomaly": "A soil-moisture anomaly is how much wetter or drier the soil is than its usual level for that place and time of year. Negative values flag developing drought. Satellite soil moisture describes only the top few centimetres, so deeper root-zone moisture is modelled, not observed.",
  "frost risk": "Frost risk is the chance that temperature drops low enough to damage a crop at a sensitive stage. Monthly averages hide cold nights, so use daily minimum temperatures and local knowledge of cold-air pockets.",
  "satellite vs ground data": "Satellite data covers large areas consistently but at coarse resolution and with indirect measurements. Ground data (a soil test, a rain gauge) is precise for one spot. The best decisions combine both, and local ground data should win when they disagree.",
};

export function explainTerm(term: string): { term: string; text: string } | null {
  const k = term.trim().toLowerCase();
  const hit = Object.keys(GLOSSARY).find((g) => k === g || k.includes(g) || g.includes(k));
  return hit ? { term: hit, text: GLOSSARY[hit] } : null;
}
