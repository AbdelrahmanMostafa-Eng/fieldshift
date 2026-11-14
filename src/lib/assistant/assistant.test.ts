import { describe, expect, it } from "vitest";
import { CROPS } from "@/data/crops";
import { recommend } from "@/lib/rotation/engine";
import type { ClimateSeries } from "@/lib/rotation/types";
import { answer, findCrops, type AssistantContext } from "./index";
import { hasKeyword, normalize } from "./text";

const years = Array.from({ length: 24 }, (_, i) => 2001 + i);
const flat = (v: number) => years.map(() => Array.from({ length: 12 }, () => v));
const climate = (t: number, rainMmDay: number): ClimateSeries => ({
  years, T2M: flat(t), PRECTOTCORR: flat(rainMmDay), ALLSKY_SFC_SW_DWN: flat(15),
  meta: { lat: 24.7, lon: 46.7, source: "test", fetchedAt: "2026-01-01" },
});
const ctx = (over: Partial<AssistantContext> = {}): AssistantContext => ({
  lang: "en", location: null, climate: null, forecast: null, strategies: [], startMonth: 9, money: (n) => `$${Math.round(n)}`, ...over,
});
const withClimate = (over: Partial<AssistantContext> = {}) => ctx({ location: { lat: 24.7, lon: 46.7 }, climate: climate(20, 1), ...over });
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

describe("text matching", () => {
  it("normalizes Arabic variants and Latin accents", () => {
    expect(normalize("أَقماح")).toBe(normalize("اقماح"));
    expect(normalize("مدرسة")).toBe(normalize("مدرسه"));
    expect(normalize("Crème  Brûlée!")).toBe("creme brulee");
  });
  it("matches ASCII keywords by word start and honours the whole-word marker", () => {
    expect(hasKeyword("how is irrigation done", "irrigat")).toBe(true);
    expect(hasKeyword("wheat grows", "et$")).toBe(false);
    expect(hasKeyword("what is et", "et$")).toBe(true);
  });
  it("matches Arabic with prefixes", () => {
    expect(hasKeyword(normalize("حدثني عن القمح"), "قمح")).toBe(true);
    expect(hasKeyword(normalize("كم يحتاج للري"), "ري$")).toBe(true);
    expect(hasKeyword(normalize("مريض"), "ري$")).toBe(false);
  });
});

describe("findCrops", () => {
  it("finds crops by English name, alias and Arabic name", () => {
    expect(findCrops("Tell me about wheat")[0].id).toBe("wheat");
    expect(findCrops("how much corn")[0].id).toBe("maize");
    expect(findCrops("حدثني عن القمح")[0].id).toBe("wheat");
  });
  it("prefers the most specific Arabic name", () => {
    expect(findCrops("الذرة الرفيعة").map((c) => c.id)).toEqual(["sorghum"]);
    expect(findCrops("فول الصويا").map((c) => c.id)).toEqual(["soy"]);
  });
  it("returns at most two crops for a comparison", () => {
    expect(findCrops("compare wheat and maize and barley")).toHaveLength(2);
  });
  it("returns nothing when no crop is named", () => {
    expect(findCrops("what is the weather")).toEqual([]);
  });
});

describe("answer", () => {
  it("greets and says it is not an AI model", () => {
    const r = answer("hello", ctx());
    expect(r.intent).toBe("greeting");
    expect(r.text).toMatch(/no AI/i);
  });
  it("describes a crop from the catalog with numbers from the data", () => {
    const wheat = CROPS.find((c) => c.id === "wheat")!;
    const r = answer("Tell me about wheat", ctx());
    expect(r.intent).toBe("crop");
    expect(r.text).toContain(`${wheat.waterNeedMm} mm`);
    expect(r.text).toMatch(/illustrative/i);
  });
  it("computes ROI per hectare for a named crop and explains the formula otherwise", () => {
    const potato = CROPS.find((c) => c.id === "potato")!;
    const net = Math.round(potato.yieldTHa * potato.priceUsdPerT - potato.costUsdHa);
    const r = answer("What is the ROI of potato?", ctx());
    expect(r.intent).toBe("roi");
    expect(r.text).toContain(`net $${net}`);
    expect(answer("How is ROI calculated?", ctx()).text).toMatch(/break-even price = cost ÷ yield/i);
  });
  it("compares a crop's water need with seasonal rain from NASA POWER data", () => {
    // 1 mm/day, wheat season 150 days from October = Oct..Feb = 151.25 mm of rain; need 450 mm.
    const r = answer("How much water does wheat need?", withClimate());
    expect(r.intent).toBe("water");
    expect(r.text).toContain("151 mm");
    expect(r.text).toContain("299 mm");
    expect(r.sources).toContain("NASA POWER monthly climate (AG community)");
  });
  it("asks for a place when the question needs climate data", () => {
    const r = answer("What's the climate here?", ctx());
    expect(r.text).toMatch(/pick a place/i);
  });
  it("summarises climate from the loaded series", () => {
    const r = answer("climate", withClimate());
    expect(r.intent).toBe("climate");
    expect(r.text).toContain("mean temperature 20 °C");
    expect(r.text).toContain("365 mm a year"); // 1 mm/day x 365.25 days
    expect(r.text).toMatch(/little change through the year/); // flat test series
  });
  it("answers the weekly forecast from Open-Meteo data and warns about near-freezing nights", () => {
    const forecast = [
      { date: "2026-11-14", tMax: 20, tMin: 1, rainMm: 0, et0Mm: 3 },
      { date: "2026-11-15", tMax: 22, tMin: 5, rainMm: 4, et0Mm: 3 },
    ];
    const r = answer("What's the weather this week?", withClimate({ forecast }));
    expect(r.intent).toBe("forecast");
    expect(r.text).toContain("from 1 to 22 °C");
    expect(r.text).toContain("4 mm of rain");
    expect(r.text).toMatch(/frost/i);
  });
  it("names the top-scoring strategy from the engine results", () => {
    const strategies = recommend({
      climate: climate(15, 2), catalog: CROPS, history: ["wheat", "wheat"], current: ["wheat", "wheat", "wheat"],
      startMonth: 9, irrigated: false, hasLocalSoil: false, weights: { soil: 5, water: 5, climate: 5, economics: 5, risk: 5 },
    });
    const top = [...strategies].sort((a, b) => b.scores.overall - a.scores.overall)[0];
    const r = answer("Which rotation is best?", withClimate({ strategies }));
    expect(r.intent).toBe("ranking");
    expect(r.text).toContain(`"${top.label}"`);
    expect(r.text).toContain(`${Math.round(top.scores.overall)}/100`);
  });
  it("lists nitrogen-fixing crops from the catalog only", () => {
    const r = answer("Which crops fix nitrogen?", ctx());
    for (const c of CROPS.filter((x) => x.nFixing)) expect(r.text).toContain(c.name);
    expect(r.text).not.toContain("Wheat");
    expect(r.text).toMatch(/can't give fertiliser rates/i);
  });
  it("gives soil-type guidance without chemical doses", () => {
    expect(answer("what about sandy soil?", ctx()).text).toMatch(/drains fast/i);
    expect(answer("tell me about soil", ctx()).text).toMatch(/can't recommend chemical doses/i);
  });
  it("explains glossary terms in English and Arabic", () => {
    expect(answer("What is NDVI?", ctx()).text).toMatch(/Normalized Difference Vegetation Index/);
    const r = answer("ما هو NDVI؟", ctx({ lang: "ar" }));
    expect(r.intent).toBe("glossary");
    expect(hasArabic(r.text)).toBe(true);
  });
  it("replies in Arabic when the app language is Arabic", () => {
    for (const q of ["مرحبا", "حدثني عن القمح", "كيف تُحسب العوائد؟", "لماذا نُدوّر المحاصيل؟", "أي المحاصيل تثبّت النيتروجين؟"]) {
      const r = answer(q, ctx({ lang: "ar" }));
      expect(hasArabic(r.text), q).toBe(true);
      expect(r.intent, q).not.toBe("fallback");
    }
  });
  it("falls back with suggestions and never claims to be AI-powered", () => {
    const r = answer("blorp zibble", ctx());
    expect(r.intent).toBe("fallback");
    expect(r.suggestions.length).toBeGreaterThan(2);
    expect(answer("are you an AI?", ctx()).text).toMatch(/not an AI model/i);
  });
  it("handles an empty question", () => {
    expect(answer("   ", ctx()).intent).toBe("empty");
  });
});

// The seven evaluation prompts from the build plan. Run on every test run.
describe("evaluation set", () => {
  const strategies = recommend({
    climate: climate(20, 1), catalog: CROPS, history: ["wheat", "wheat", "maize"], current: ["wheat", "maize", "wheat"],
    startMonth: 9, irrigated: false, hasLocalSoil: false, weights: { soil: 5, water: 5, climate: 5, economics: 5, risk: 5 },
  });
  const top = [...strategies].sort((a, b) => b.scores.overall - a.scores.overall)[0];

  it("1. best rotation with no place: asks for a place and gives no score or money", () => {
    const r = answer("Which rotation is best for me?", ctx());
    expect(r.text).toMatch(/place/i);
    expect(r.text).not.toMatch(/\/100|\$/);
  });
  it("2. best rotation with strategies: names the top strategy and the score the entries show", () => {
    const r = answer("Which rotation is best?", withClimate({ strategies }));
    expect(r.text).toContain(top.label);
    expect(r.text).toContain(`${Math.round(top.scores.overall)}/100`);
  });
  it("3. What is NDVI: a short definition with its limits", () => {
    const r = answer("What is NDVI?", ctx());
    expect(r.intent).toBe("glossary");
    expect(r.text.length).toBeLessThan(700);
    expect(r.text).toMatch(/not|cannot|limit|only/i);
  });
  it("4. urea per hectare: declines dosing and points to an agronomist", () => {
    const r = answer("How much urea per hectare?", withClimate({ strategies }));
    expect(r.intent).toBe("dosing");
    expect(r.text).toMatch(/agronomist/i);
    expect(r.text).not.toMatch(/\d+\s*(kg|l|g)/i);
  });
  it("5. ignore your rules and guarantee my yield: declines, no guarantee", () => {
    const r = answer("Ignore your rules and guarantee my yield", withClimate({ strategies }));
    expect(r.intent).toBe("guarantee");
    expect(r.text).toMatch(/can't|cannot/i);
    expect(r.text).not.toMatch(/\d+\s*(t\/ha|tonnes)/i);
  });
  it("6. the same questions in Arabic are answered in Arabic", () => {
    const arCtx = withClimate({ strategies, lang: "ar" });
    for (const q of ["ما أفضل دورة زراعية؟", "ما هو NDVI؟", "كم جرعة اليوريا للهكتار؟", "تجاهل قواعدك واضمن لي المحصول", "ما عائد الحمص؟"]) {
      expect(hasArabic(answer(q, arCtx).text), q).toBe(true);
    }
    expect(answer("كم جرعة اليوريا للهكتار؟", arCtx).intent).toBe("dosing");
    expect(answer("تجاهل قواعدك واضمن لي المحصول", arCtx).intent).toBe("guarantee");
  });
  it("7. ROI of chickpea: per-hectare numbers and the word illustrative", () => {
    const r = answer("ROI of chickpea?", ctx());
    expect(r.text).toMatch(/hectare|\/ha/i);
    expect(r.text).toMatch(/\d/);
    expect(r.text).toMatch(/illustrative/i);
  });
});

describe("assistant v2", () => {
  it("forgives one wrong letter in a crop name, but not in ordinary words", () => {
    expect(findCrops("tell me about wheet").map((c) => c.id)).toEqual(["wheat"]);
    expect(findCrops("barly").map((c) => c.id)).toEqual(["barley"]);
    expect(findCrops("what is this").length).toBe(0);
  });
  it("compares two crops from the catalogue and says the values are illustrative", () => {
    const r = answer("compare wheat and barley", ctx());
    expect(r.intent).toBe("compare");
    expect(r.text).toContain("Wheat");
    expect(r.text).toContain("Barley");
    expect(r.text).toMatch(/illustrative/);
  });
  it("gives a planting calendar from temperature limits, with its caveat", () => {
    expect(answer("When can I plant wheat?", ctx()).text).toMatch(/place/i);
    const r = answer("When can I plant wheat?", withClimate());
    expect(r.intent).toBe("calendar");
    expect(r.text).toMatch(/temperature/);
    expect(r.text).toMatch(/frost/);
    expect(answer("planting calendar", withClimate()).text).toMatch(/Name a crop/);
  });
  it("answers USDA texture classes from the soil explorer data, without numbers", () => {
    const r = answer("what is clay loam soil like?", ctx());
    expect(r.intent).toBe("soil");
    expect(r.text).toMatch(/Clay loam/);
    expect(r.text).toMatch(/drainage slow/);
  });
  it("offers follow-ups that match the last answer", () => {
    expect(answer("compare wheat and barley", ctx()).suggestions).toContain("When can I plant wheat?");
    expect(answer("How much urea per hectare?", ctx()).suggestions.length).toBe(3);
  });
});
