// Atlas v2 additions. Still rule-based: keyword checks and fixed templates filled from the app's own data.
// No model, no network call, no key.
import { CROPS, cropName } from "@/data/crops";
import { TEXTURE_CLASSES, type Level3 } from "@/data/reference";
import { climatology } from "@/lib/climatology";
import { plantingWindow } from "@/lib/farm";
import { economics } from "@/lib/roi";
import { hasEconomics } from "@/lib/rotation/engine";
import type { ClimateSeries, Crop } from "@/lib/rotation/types";
import { hasKeyword } from "./text";

export type L = { en: string; ar: string };
const any = (q: string, words: string[]) => words.some((w) => hasKeyword(q, w));

// ---- things Atlas must refuse -------------------------------------------------------------------
const DOSING = ["urea", "dose", "dosage", "spray rate", "application rate", "how much fertil", "pesticide", "herbicide", "fungicide", "insecticide", "glyphosate", "npk", "ammonium", "يوريا", "جرعه", "جرعات", "مبيد", "مبيدات", "كم كيلو", "معدل الرش", "كميه السماد"];
const OVERRIDE = ["guarantee", "ignore your rules", "ignore previous", "ignore all", "promise me", "pretend you", "اضمن", "ضمان", "تضمن", "تجاهل"];
export const isDosing = (q: string) => any(q, DOSING);
export const isOverride = (q: string) => any(q, OVERRIDE);
export const DECLINE_DOSING: L = {
  en: "I can't help with that. Rates and doses for fertiliser, pesticide or any other chemical depend on a soil test, the product label and local rules, and a wrong number can harm the crop, the soil or people. Please ask a local agronomist or extension officer. I can still help with rotations, soil types, water needs and costs.",
  ar: "لا أستطيع المساعدة في ذلك. معدلات وجرعات الأسمدة والمبيدات وأي مواد كيميائية تعتمد على تحليل التربة وملصق المنتج والأنظمة المحلية، والرقم الخاطئ قد يضر بالمحصول أو التربة أو الناس. من فضلك اسأل مهندسًا زراعيًا أو مرشدًا زراعيًا محليًا. ما زلت أستطيع المساعدة في الدورات الزراعية وأنواع التربة واحتياجات المياه والتكاليف.",
};
export const DECLINE_GUARANTEE: L = {
  en: "I can't do that. I work from fixed rules and the app's data, and nothing here is a guarantee: scores are middle values across past seasons, with a range and stated gaps. No tool can promise a yield. Ask me which rotation scores best, or what the data does not know.",
  ar: "لا أستطيع ذلك. أعمل بقواعد ثابتة وببيانات التطبيق، ولا شيء هنا يُعدّ ضمانًا: الدرجات قيم وسطية عبر المواسم السابقة، مع نطاق وثغرات معلنة. لا توجد أداة تستطيع أن تعد بمحصول. اسألني أي دورة تحصل على أعلى درجة، أو ما الذي لا تعرفه البيانات.",
};

// ---- typo tolerance, crop names only ------------------------------------------------------------
/** True when the two words differ by at most one inserted, removed or changed letter. */
export function within1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const LATIN_NAMES: { crop: Crop; name: string }[] = CROPS.flatMap((crop) =>
  [crop.id, crop.name.replace(/\(.*\)/, "").trim().toLowerCase(), ...(crop.aliases ?? [])].filter((n) => /^[a-z]{5,}$/.test(n)).map((name) => ({ crop, name })));
/** Crops whose name is one letter away from a word in the question. Words under five letters or with a different first letter never match ("what" is not "wheat"). */
export function fuzzyCrops(qNormalized: string): Crop[] {
  const words = qNormalized.split(/[^a-z]+/).filter((w) => w.length >= 5);
  const found = LATIN_NAMES.filter(({ name }) => words.some((w) => w[0] === name[0] && within1(w, name))).map((x) => x.crop);
  return [...new Set(found)].slice(0, 2);
}

// ---- compare two crops --------------------------------------------------------------------------
const COMPARE = ["compare", "versus", "vs$", "difference between", "better than", "قارن", "مقارنه", "الفرق بين", "ام$"];
export const isCompare = (q: string) => any(q, COMPARE);
export function compareCrops(a: Crop, b: Crop, money: (usd: number) => string): L {
  const net = (c: Crop, lang: "en" | "ar") => !hasEconomics(c)
    ? (lang === "en" ? "net: not available in the catalogue" : "الصافي: غير متاح في الكتالوج")
    : (lang === "en" ? `net about ${money(economics({ yieldTHa: c.yieldTHa, priceUsdPerT: c.priceUsdPerT, costUsdHa: c.costUsdHa }).net)} per hectare (illustrative)`
      : `صافٍ نحو ${money(economics({ yieldTHa: c.yieldTHa, priceUsdPerT: c.priceUsdPerT, costUsdHa: c.costUsdHa }).net)} للهكتار (توضيحي)`);
  const line = (c: Crop, lang: "en" | "ar") => lang === "en"
    ? `${c.name}: about ${c.waterNeedMm} mm of water, ~${c.seasonDays} days, best at ${c.tOptLow}-${c.tOptHigh} °C, ${c.nFixing ? "fixes nitrogen" : "does not fix nitrogen"}, ${net(c, "en")}.`
    : `${cropName(c.id, "ar")}: نحو ${c.waterNeedMm} ملم ماء، ~${c.seasonDays} يومًا، الأفضل عند ${c.tOptLow}-${c.tOptHigh} °م، ${c.nFixing ? "يثبّت النيتروجين" : "لا يثبّت النيتروجين"}، ${net(c, "ar")}.`;
  const thirstier = a.waterNeedMm === b.waterNeedMm ? null : a.waterNeedMm > b.waterNeedMm ? a : b;
  return {
    en: `${line(a, "en")}\n${line(b, "en")}\n${thirstier ? `${thirstier.name} needs more water. ` : ""}Water, season and temperatures are FAO EcoCrop values for the species, not measurements from your field.`,
    ar: `${line(a, "ar")}\n${line(b, "ar")}\n${thirstier ? `${cropName(thirstier.id, "ar")} يحتاج ماءً أكثر. ` : ""}الماء والموسم والحرارة قيم الفاو EcoCrop للنوع، وليست قياسات من حقلك.`,
  };
}

// ---- planting calendar by temperature -----------------------------------------------------------
const CALENDAR = ["when to plant", "when can i plant", "when should i plant", "when do i plant", "planting month", "planting window", "planting date", "sow", "calendar", "متي ازرع", "متى ازرع", "موعد زراعه", "موعد الزراعه", "مواعيد الزراعه", "ميعاد"];
export const isCalendar = (q: string) => any(q, CALENDAR);
export const CALENDAR_NEEDS_CROP: L = {
  en: "Name a crop and I'll check its temperature limits against this place's months, for example: When can I plant wheat?",
  ar: "اذكر محصولًا لأقارن حدوده الحرارية بأشهر هذا المكان، مثلًا: متى أزرع القمح؟",
};
export function calendarFor(crop: Crop, climate: ClimateSeries): L {
  const fits = plantingWindow(crop, climatology(climate));
  const months = (lang: string, want: string) => fits.map((f, m) => (f === want ? new Intl.DateTimeFormat(lang, { calendar: "gregory", month: "long" }).format(new Date(2026, m, 1)) : null)).filter(Boolean);
  const text = (lang: "en" | "ar"): string => {
    const good = months(lang, "good"), possible = months(lang, "possible"), sep = lang === "ar" ? "، " : ", ";
    const name = lang === "ar" ? cropName(crop.id, "ar") : crop.name;
    if (lang === "en") {
      const body = good.length ? `Best planting months: ${good.join(sep)}.${possible.length ? ` Also tolerated: ${possible.join(sep)}.` : ""}`
        : possible.length ? `No month keeps the whole season in its best range. Tolerated planting months: ${possible.join(sep)}.`
        : "No planting month keeps the whole season inside its temperature limits here.";
      return `${name}, by monthly mean temperature only (a ~${crop.seasonDays}-day season, best ${crop.tOptLow}-${crop.tOptHigh} °C, tolerated ${crop.tMin}-${crop.tMax} °C). ${body} This is derived from FAO EcoCrop temperature limits. It does not see frost nights, rain, day length or varieties, so check with a local calendar.`;
    }
    const body = good.length ? `أفضل أشهر الزراعة: ${good.join(sep)}.${possible.length ? ` ومقبول أيضًا: ${possible.join(sep)}.` : ""}`
      : possible.length ? `لا يوجد شهر يُبقي الموسم كله في النطاق الأفضل. أشهر الزراعة المقبولة: ${possible.join(sep)}.`
      : "لا يوجد شهر زراعة يُبقي الموسم كله ضمن الحدود الحرارية هنا.";
    return `${name}، بحسب متوسط الحرارة الشهري فقط (موسم ~${crop.seasonDays} يومًا، الأفضل ${crop.tOptLow}-${crop.tOptHigh} °م، والمحتمل ${crop.tMin}-${crop.tMax} °م). ${body} هذا مشتق من الحدود الحرارية في قاعدة بيانات الفاو EcoCrop، ولا يرى ليالي الصقيع ولا المطر ولا طول النهار ولا الأصناف، فراجع تقويمًا محليًا.`;
  };
  return { en: text("en"), ar: text("ar") };
}

// ---- soil texture classes (from the soil explorer's data) ---------------------------------------
const TEXTURE_NAMES: { id: string; en: string; ar: string; words: string[] }[] = [
  { id: "sandyClayLoam", en: "Sandy clay loam", ar: "طمي طيني رملي", words: ["sandy clay loam", "طمي طيني رملي"] },
  { id: "siltyClayLoam", en: "Silty clay loam", ar: "طمي طيني سلتي", words: ["silty clay loam", "طمي طيني سلتي"] },
  { id: "loamySand", en: "Loamy sand", ar: "رمل طميي", words: ["loamy sand", "رمل طميي"] },
  { id: "sandyLoam", en: "Sandy loam", ar: "طمي رملي", words: ["sandy loam", "طمي رملي"] },
  { id: "siltLoam", en: "Silt loam", ar: "طمي سلتي", words: ["silt loam", "silty loam", "طمي سلتي"] },
  { id: "clayLoam", en: "Clay loam", ar: "طمي طيني", words: ["clay loam", "طمي طيني"] },
  { id: "sandyClay", en: "Sandy clay", ar: "طين رملي", words: ["sandy clay", "طين رملي"] },
  { id: "siltyClay", en: "Silty clay", ar: "طين سلتي", words: ["silty clay", "طين سلتي"] },
];
const LEVEL_EN: Record<Level3, string> = { low: "low", medium: "medium", high: "high" }, SPEED_EN: Record<Level3, string> = { low: "slow", medium: "moderate", high: "fast" };
const LEVEL_AR: Record<Level3, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع" }, SPEED_AR: Record<Level3, string> = { low: "بطيء", medium: "متوسط", high: "سريع" };
/** A two- or three-word USDA texture class named in the question. Plain "sand", "clay" and "loam" are left to the older soil answers. */
export function textureAnswer(q: string): L | null {
  const hit = TEXTURE_NAMES.find((n) => any(q, n.words));
  const c = hit && TEXTURE_CLASSES.find((x) => x.id === hit.id);
  if (!hit || !c) return null;
  return {
    en: `${hit.en} (USDA texture class): drainage ${SPEED_EN[c.drainage]}, water holding ${LEVEL_EN[c.waterHolding]}, effort to work ${LEVEL_EN[c.effort]}. This is general guidance by texture, not a measurement of your field. The Soil tab shows all 12 classes on the texture triangle.`,
    ar: `${hit.ar} (صنف قوام بحسب USDA): الصرف ${SPEED_AR[c.drainage]}، الاحتفاظ بالماء ${LEVEL_AR[c.waterHolding]}، الجهد اللازم للخدمة ${LEVEL_AR[c.effort]}. هذا إرشاد عام بحسب القوام وليس قياسًا لحقلك. تبويب التربة يعرض الأصناف الاثني عشر على مثلث القوام.`,
  };
}

// ---- follow-up suggestions that depend on what was just asked -----------------------------------
export const FOLLOW: Record<string, { en: string[]; ar: string[] }> = {
  crop: { en: ["Compare wheat and barley", "When can I plant wheat?", "ROI of chickpea?"], ar: ["قارن القمح والشعير", "متى أزرع القمح؟", "ما عائد الحمص؟"] },
  compare: { en: ["When can I plant wheat?", "Which rotation is best?", "ROI of chickpea?"], ar: ["متى أزرع القمح؟", "ما أفضل دورة زراعية؟", "ما عائد الحمص؟"] },
  roi: { en: ["How is ROI calculated?", "Compare maize and sorghum", "Which rotation is best?"], ar: ["كيف تُحسب العوائد؟", "قارن الذرة الشامية والذرة الرفيعة", "ما أفضل دورة زراعية؟"] },
  climate: { en: ["When can I plant maize?", "What's the weather this week?", "Which rotation is best?"], ar: ["متى أزرع الذرة الشامية؟", "كيف الطقس هذا الأسبوع؟", "ما أفضل دورة زراعية؟"] },
  calendar: { en: ["Summarise the climate here", "What's the weather this week?", "Compare wheat and barley"], ar: ["لخّص المناخ هنا", "كيف الطقس هذا الأسبوع؟", "قارن القمح والشعير"] },
  ranking: { en: ["Why rotate crops?", "Which crops fix nitrogen?", "ROI of chickpea?"], ar: ["لماذا نُدوّر المحاصيل؟", "أي المحاصيل تثبّت النيتروجين؟", "ما عائد الحمص؟"] },
  soil: { en: ["What is clay loam like?", "What about sandy loam?", "Why rotate crops?"], ar: ["كيف هي تربة الطمي الطيني؟", "وماذا عن الطمي الرملي؟", "لماذا نُدوّر المحاصيل؟"] },
  dosing: { en: ["Which crops fix nitrogen?", "Why rotate crops?", "Tell me about clay soil"], ar: ["أي المحاصيل تثبّت النيتروجين؟", "لماذا نُدوّر المحاصيل؟", "حدثني عن التربة الطينية"] },
  guarantee: { en: ["Which rotation is best?", "What is NDVI?", "Why rotate crops?"], ar: ["ما أفضل دورة زراعية؟", "ما هو NDVI؟", "لماذا نُدوّر المحاصيل؟"] },
};
