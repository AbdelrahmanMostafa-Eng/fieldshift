// A free, rule-based farm helper. No AI model, no network calls, no API keys.
// It matches keywords (English + Arabic) to intents and fills fixed templates from the app's own data:
// the crop catalog, the rotation engine's results, NASA POWER climate and the Open-Meteo forecast.
import { CROPS, cropName } from "@/data/crops";
import { fertilityNotes } from "@/lib/fertility";
import { GLOSSARY } from "@/lib/glossary";
import arMessages from "../../../messages/ar.json";
import enMessages from "../../../messages/en.json";
import { economics } from "@/lib/roi";
import { hasEconomics, monthsFor } from "@/lib/rotation/engine";
import type { ClimateSeries, Crop, Monthly, Strategy } from "@/lib/rotation/types";
import type { ForecastDay } from "@/lib/openmeteo";
import { GLOSSARY_AR } from "./arabic-glossary";
import { hasKeyword, normalize } from "./text";
import {
  CALENDAR_NEEDS_CROP, DECLINE_DOSING, DECLINE_GUARANTEE, FOLLOW, calendarFor, compareCrops, fuzzyCrops,
  isCalendar, isCompare, isDosing, isOverride, textureAnswer,
} from "./extra";

export interface AssistantContext {
  lang: string;
  location: { lat: number; lon: number } | null;
  climate: ClimateSeries | null;
  forecast: ForecastDay[] | null;
  strategies: Strategy[];
  startMonth: number; // 0 = January
  money: (usd: number) => string;
}
export interface Reply { intent: string; text: string; sources: string[]; suggestions: string[] }

type L = { en: string; ar: string };
const ar = (ctx: AssistantContext) => ctx.lang === "ar";
const pick = (ctx: AssistantContext, v: L) => (ar(ctx) ? v.ar : v.en);

const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Mean over years of one calendar month, ignoring gaps. */
function monthMean(m: Monthly, month: number): number | null {
  const v = m.map((row) => row[month]).filter((x): x is number => x !== null);
  return v.length ? mean(v) : null;
}
/** Month names in the answer's own language: Atlas answers in English or Arabic, whatever the page language is. */
const monthName = (ctx: AssistantContext, m: number) => new Intl.DateTimeFormat(ar(ctx) ? "ar" : "en", { calendar: "gregory", month: "long" }).format(new Date(2026, m, 1));

// ---------- crop detection ----------
/** Drop the Arabic definite article so "الذرة الرفيعة" matches the alias "ذرة رفيعة". */
const stripAl = (s: string) => s.replace(/(^| )ال(?=\S{2,})/g, "$1");
const cropNames = (c: Crop) => [c.id, c.name.replace(/\(.*\)/, ""), ...(c.aliases ?? [])].map((x) => stripAl(normalize(x))).filter(Boolean);

export function findCrops(question: string): Crop[] {
  const q = stripAl(normalize(question));
  const hits: { crop: Crop; alias: string }[] = [];
  for (const crop of CROPS) {
    for (const alias of cropNames(crop)) if (hasKeyword(q, alias)) hits.push({ crop, alias });
  }
  // "ذرة رفيعة" (sorghum) contains "ذرة" (maize): keep only the most specific match.
  const keep = hits.filter((h) => !hits.some((o) => o.crop !== h.crop && o.alias.length > h.alias.length && o.alias.includes(h.alias)));
  const exact = [...new Map(keep.map((h) => [h.crop.id, h.crop])).values()].slice(0, 2);
  // Nothing matched exactly: allow one wrong letter in a crop name ("wheet", "barly").
  return exact.length ? exact : fuzzyCrops(q);
}
const cropLabel = (id: string) => CROPS.find((c) => c.id === id)?.name ?? id;

// ---------- intents ----------
interface Intent { id: string; words: string[] }
const INTENTS: Intent[] = [
  { id: "greeting", words: ["hello", "hi$", "hey", "good morning", "salam", "السلام", "مرحبا", "اهلا", "صباح الخير"] },
  { id: "glossary", words: ["what is et$", "evapotranspiration", "ndvi", "vegetation index", "greenness", "soil moisture", "frost", "freeze", "satellite vs", "ground data", "how accurate", "can i trust", "تبخر", "رطوبه التربه", "صقيع", "دقه", "مؤشر النبات"] },
  { id: "forecast", words: ["forecast", "this week", "tomorrow", "next days", "will it rain", "rain today", "weather today", "توقعات", "الاسبوع", "غدا", "هل ستمطر", "طقس اليوم"] },
  { id: "roi", words: ["roi", "profit", "cost", "revenue", "return", "break even", "breakeven", "income", "earn", "price", "تكلفه", "ربح", "ارباح", "عائد", "عوائد", "ايراد", "دخل", "سعر", "تعادل", "تكاليف"] },
  { id: "water", words: ["water", "irrigat", "rain", "drought", "dry", "thirst", "مياه", "ماء", "ري$", "الري", "مطر", "جفاف", "عطش"] },
  { id: "climate", words: ["climate", "temperature", "weather", "season", "hot$", "cold$", "warm", "مناخ", "حراره", "طقس", "موسم", "حر$", "بارد"] },
  { id: "nfix", words: ["nitrogen", "legume", "fix", "fertil", "نيتروجين", "بقوليات", "تسميد", "سماد"] },
  { id: "soil", words: ["soil", "sandy", "sand$", "clay", "loam", "silt", "saline", "salinity", "peat", "organic matter", "salt", "تربه", "رمليه", "رمل", "طين", "طيني", "طمي", "مالحه", "ملوحه", "عضويه"] },
  { id: "ranking", words: ["best", "recommend", "which strategy", "why is", "compare", "افضل", "انسب", "توصيه", "قارن"] },
  { id: "rotation", words: ["rotation", "rotate", "crop order", "what next", "دوره", "تناوب", "ندور", "تدوير"] },
  { id: "sources", words: ["source", "where does", "data from", "nasa", "open meteo", "who made", "free", "ai$", "robot", "bot$", "مصدر", "من اين", "ناسا", "مجاني", "ذكاء"] },
  { id: "howto", words: ["how do i", "how to use", "help", "start", "use the app", "find my location", "كيف", "مساعده", "ابدا", "استخدم"] },
];

function score(q: string, i: Intent): number {
  return i.words.reduce((s, w) => s + (hasKeyword(q, w) ? 1 : 0), 0);
}

// ---------- soil knowledge (general, no chemical dosing) ----------
const SOILS: { id: string; words: string[]; en: string; ar: string }[] = [
  { id: "sandy", words: ["sandy", "sand$", "رمل"], en: "Sandy soil drains fast and warms early but holds little water and few nutrients. Favour drought-tolerant crops, add organic matter (compost, residues), irrigate little and often, and use deep-rooted legumes or cover crops to build it up.", ar: "التربة الرملية سريعة الصرف وتدفأ مبكرًا لكنها تحتفظ بقليل من الماء والعناصر. فضّل المحاصيل المتحمّلة للجفاف، وأضف مادة عضوية (كمبوست أو مخلفات)، واروِ قليلًا وبتكرار، واستخدم بقوليات عميقة الجذور أو محاصيل تغطية لتحسينها." },
  { id: "clay", words: ["clay", "طين"], en: "Clay soil holds water and nutrients well but drains slowly, warms late and cracks or compacts. Avoid working it wet, keep residues on top, and use rotations with deep roots (e.g. canola, alfalfa) to open it. Waterlogging, not drought, is usually the risk.", ar: "التربة الطينية تحتفظ بالماء والعناصر جيدًا لكنها بطيئة الصرف وتدفأ متأخرة وقد تتشقق أو تتراص. تجنّب حراثتها وهي مبللة، وأبقِ المخلفات على السطح، واستخدم دورات بجذور عميقة (مثل الكانولا والبرسيم الحجازي). الخطر عادةً هو تشبّع الماء لا الجفاف." },
  { id: "silt", words: ["silt", "طمي"], en: "Silty soil is smooth, fertile and holds water well, but it crusts and erodes easily. Protect it with residue cover and avoid leaving it bare between crops.", ar: "التربة الطميية ناعمة وخصبة وتحتفظ بالماء جيدًا، لكنها تتقشّر وتنجرف بسهولة. احمِها بغطاء من المخلفات ولا تتركها عارية بين المحاصيل." },
  { id: "loam", words: ["loam", "لوم", "خصبه"], en: "Loam is a balanced mix of sand, silt and clay: good drainage and water holding. It suits most crops, so rotation choices are driven more by climate, water and income than by the soil itself.", ar: "التربة اللومية خليط متوازن من الرمل والطمي والطين: صرف جيد واحتفاظ جيد بالماء. تناسب معظم المحاصيل، لذا تتحدد خيارات الدورة بالمناخ والماء والدخل أكثر من التربة نفسها." },
  { id: "saline", words: ["saline", "salinity", "salt", "مالحه", "ملوحه", "ملح"], en: "Saline soil stresses most crops and gets worse with poor drainage and salty irrigation water. Barley and sorghum tolerate more salt than soy or potato. Good drainage and enough water to leach salts matter most. Get a local soil/water test: satellites cannot measure salinity reliably.", ar: "التربة المالحة تجهد معظم المحاصيل وتسوء مع ضعف الصرف وماء الري المالح. الشعير والذرة الرفيعة أكثر تحمّلًا للملوحة من فول الصويا والبطاطس. الأهم هو الصرف الجيد وماء كافٍ لغسل الأملاح. اطلب تحليلًا محليًا للتربة والماء فالأقمار الصناعية لا تقيس الملوحة بموثوقية." },
];

const SRC = {
  catalog: "FAO EcoCrop crop requirements",
  econ: "Catalogue economics (illustrative demo values)",
  power: "NASA POWER monthly climate (AG community)",
  engine: "FieldShift rotation engine",
  meteo: "Open-Meteo forecast",
  glossary: "FieldShift glossary",
  built: "Built-in farming rules of thumb",
  texture: "USDA soil texture classes (general guidance)",
  fertility: "General nutrient-management principles (FAO 2006; IPNI 4R), no doses",
};

/** Fertility notes for one crop, in the same words the crop library shows (messages/*.json, fertility.*). No doses. */
function fertilityAnswer(c: Crop): L {
  const notes = fertilityNotes(c);
  const en = enMessages.fertility as Record<string, string>, ar = arMessages.fertility as Record<string, string>;
  return {
    en: `${c.name}: ${notes.map((k) => en[k]).join(" ")}`,
    ar: `${cropName(c.id, "ar")}: ${notes.map((k) => ar[k]).join(" ")}`,
  };
}
const FERTILITY_WORDS = ["fertil", "manure", "compost", "nutrient", "سماد", "تسميد", "اسمده", "مغذيات"];

const SUGGEST: { en: string[]; ar: string[] } = {
  en: ["Tell me about wheat", "How is ROI calculated?", "Why rotate crops?", "What is NDVI?", "Which crops fix nitrogen?", "What's the weather this week?"],
  ar: ["حدثني عن القمح", "كيف تُحسب العوائد؟", "لماذا نُدوّر المحاصيل؟", "ما هو NDVI؟", "أي المحاصيل تثبّت النيتروجين؟", "كيف الطقس هذا الأسبوع؟"],
};

const reply = (ctx: AssistantContext, intent: string, text: L, sources: string[], extra?: string[]): Reply => ({
  intent, text: pick(ctx, text), sources, suggestions: extra ?? FOLLOW[intent]?.[ar(ctx) ? "ar" : "en"] ?? SUGGEST[ar(ctx) ? "ar" : "en"].slice(0, 3),
});

const needPlace = (ctx: AssistantContext, intent: string): Reply =>
  reply(ctx, intent, {
    en: "Pick a place first: search for it, tap Find my location, or tap the globe. Then I can read 24 seasons of NASA climate for that spot.",
    ar: "اختر مكانًا أولًا: ابحث عنه أو اضغط «حدّد موقعي» أو المس الكرة الأرضية. بعدها أقرأ لك 24 موسمًا من بيانات ناسا المناخية لذلك الموقع.",
  }, []);

const climateLoading = (ctx: AssistantContext, intent: string): Reply =>
  reply(ctx, intent, { en: "The climate data for that place is still loading or failed to load. Give it a few seconds, then ask again.", ar: "بيانات المناخ لذلك المكان ما زالت قيد التحميل أو تعذّر تحميلها. انتظر بضع ثوانٍ ثم اسأل مجددًا." }, []);

// ---------- responders ----------
const FAMILY_AR: Record<string, string> = {
  cereal: "حبوب", legume: "بقوليات", brassica: "صليبيات", solanum: "باذنجانيات", root: "محاصيل جذرية", oilseed: "بذور زيتية",
  cucurbit: "قرعيات", forage: "أعلاف", allium: "ثوميات", mallow: "خبازيات", amaranth: "قطيفيات",
};
const RESIDUE_AR: Record<Crop["residue"], string> = { low: "قليلة", medium: "متوسطة", high: "كثيرة" };

/** Per-hectare economics from the catalogue, or null when the crop has none. */
const cropEcon = (c: Crop) => (hasEconomics(c) ? economics({ yieldTHa: c.yieldTHa, priceUsdPerT: c.priceUsdPerT, costUsdHa: c.costUsdHa }) : null);

function cropCard(ctx: AssistantContext, c: Crop): L {
  const e = cropEcon(c);
  const fix = c.nFixing;
  const kill = c.killC === null ? null : c.killC;
  const econEn = hasEconomics(c) && e
    ? `Demo economics per hectare (illustrative, not market prices): ${c.yieldTHa} t/ha at ${ctx.money(c.priceUsdPerT)}/t, cost ${ctx.money(c.costUsdHa)}, net ${ctx.money(e.net)}.`
    : "Yield, price and cost: not available in the catalogue. Enter your own in the Costs tab.";
  const econAr = hasEconomics(c) && e
    ? `الاقتصاد التوضيحي للهكتار (قيم تجريبية وليست أسعار سوق): ${c.yieldTHa} طن/هكتار بسعر ${ctx.money(c.priceUsdPerT)}/طن، التكلفة ${ctx.money(c.costUsdHa)}، الصافي ${ctx.money(e.net)}.`
    : "الإنتاج والسعر والتكلفة: غير متاحة في الكتالوج. أدخل أرقامك في تبويب التكاليف.";
  return {
    en: `${c.name} (${c.family}, ${c.scientific}). FAO EcoCrop: best ${c.tOptLow}-${c.tOptHigh} °C and tolerates ${c.tMin}-${c.tMax} °C as a monthly mean${kill !== null ? `; killed near ${kill} °C` : ""}. Rain over the crop cycle: best ${c.rainMm.optLow}-${c.rainMm.optHigh} mm, tolerates ${c.rainMm.min}-${c.rainMm.max} mm. Crop cycle ${c.cycleDays[0]}-${c.cycleDays[1]} days. ${fix ? "It fixes nitrogen, so it is a good break crop." : "It does not fix nitrogen."} Residue: ${c.residue}.\n${econEn}`,
    ar: `${cropName(c.id, "ar")} (${FAMILY_AR[c.family] ?? c.family}، ${c.scientific}). بحسب قاعدة بيانات الفاو EcoCrop: الأفضل ${c.tOptLow}-${c.tOptHigh} °م ويتحمل ${c.tMin}-${c.tMax} °م كمتوسط شهري${kill !== null ? `؛ ويموت قرب ${kill} °م` : ""}. المطر خلال دورة المحصول: الأفضل ${c.rainMm.optLow}-${c.rainMm.optHigh} ملم، ويتحمل ${c.rainMm.min}-${c.rainMm.max} ملم. دورة المحصول ${c.cycleDays[0]}-${c.cycleDays[1]} يومًا. ${fix ? "يثبّت النيتروجين فهو محصول جيد للتناوب." : "لا يثبّت النيتروجين."} المخلفات: ${RESIDUE_AR[c.residue]}.\n${econAr}`,
  };
}

function climateSummary(ctx: AssistantContext): Reply {
  if (!ctx.location) return needPlace(ctx, "climate");
  if (!ctx.climate) return climateLoading(ctx, "climate");
  const c = ctx.climate;
  const temps = Array.from({ length: 12 }, (_, m) => monthMean(c.T2M, m));
  const rain = Array.from({ length: 12 }, (_, m) => { const v = monthMean(c.PRECTOTCORR, m); return v === null ? null : v * DAYS[m]; });
  const tv = temps.filter((x): x is number => x !== null);
  const rv = rain.filter((x): x is number => x !== null);
  if (!tv.length) return climateLoading(ctx, "climate");
  const idx = (arr: (number | null)[], pickMax: boolean) => arr.reduce<number>((best, v, i) => (v === null ? best : best < 0 || (pickMax ? v > (arr[best] as number) : v < (arr[best] as number)) ? i : best), -1);
  const hot = idx(temps, true), cold = idx(temps, false), wet = idx(rain, true), dry = idx(rain, false);
  const yrs = `${c.years[0]}-${c.years[c.years.length - 1]}`;
  const total = rv.length ? r0(rv.reduce((s, v) => s + v, 0)) : null;
  const flatT = (temps[hot] as number) - (temps[cold] as number) < 1;
  return reply(ctx, "climate", {
    en: `For this place, NASA POWER (${yrs} average): mean temperature ${r1(mean(tv))} °C${flatT ? " with little change through the year" : `; warmest month ${monthName(ctx, hot)} (${r1(temps[hot] as number)} °C), coolest ${monthName(ctx, cold)} (${r1(temps[cold] as number)} °C)`}.${total !== null ? ` Rainfall about ${total} mm a year; wettest ${monthName(ctx, wet)} (${r0(rain[wet] as number)} mm), driest ${monthName(ctx, dry)} (${r0(rain[dry] as number)} mm).` : ""} These are monthly averages on a coarse grid, so they hide cold nights, heat spikes and single storms.`,
    ar: `لهذا المكان، بيانات ناسا POWER (متوسط ${yrs}): متوسط الحرارة ${r1(mean(tv))} °م${flatT ? " مع تغيّر طفيف عبر السنة" : `؛ أدفأ شهر ${monthName(ctx, hot)} (${r1(temps[hot] as number)} °م) وأبرده ${monthName(ctx, cold)} (${r1(temps[cold] as number)} °م)`}.${total !== null ? ` المطر نحو ${total} ملم سنويًا؛ أمطر شهر ${monthName(ctx, wet)} (${r0(rain[wet] as number)} ملم) وأجفّه ${monthName(ctx, dry)} (${r0(rain[dry] as number)} ملم).` : ""} هذه متوسطات شهرية على شبكة خشنة، فهي تُخفي الليالي الباردة وموجات الحر والعواصف المفردة.`,
  }, [SRC.power]);
}

/** Average rain (mm) over the crop's season, starting at the planting month. */
function seasonRainMm(ctx: AssistantContext, crop: Crop): number | null {
  if (!ctx.climate) return null;
  const vals = monthsFor(ctx.startMonth, crop.seasonDays).map((m) => { const v = monthMean(ctx.climate!.PRECTOTCORR, m); return v === null ? null : v * DAYS[m]; });
  return vals.every((v): v is number => v !== null) ? vals.reduce((s, v) => s + v, 0) : null;
}

function waterAnswer(ctx: AssistantContext, crops: Crop[]): Reply {
  const c = crops[0];
  if (!c) {
    return reply(ctx, "water", {
      en: "Name a crop and I'll compare its water need with the rain at your place (for example: how much water does maize need?). General rules: match the crop to the rainfall you actually get, irrigate at the stages that matter most, keep residue on the soil to cut evaporation, and plant drought-tolerant crops like sorghum or chickpea where water is short.",
      ar: "اذكر محصولًا وسأقارن احتياجه من الماء بالمطر في موقعك (مثلًا: كم يحتاج الذرة من الماء؟). قواعد عامة: اختر المحصول وفق المطر الفعلي، واروِ في المراحل الأهم، وأبقِ المخلفات على التربة لتقليل التبخر، وازرع محاصيل متحمّلة للجفاف كالذرة الرفيعة والحمص حيث يقل الماء.",
    }, [SRC.built, SRC.catalog]);
  }
  const rain = seasonRainMm(ctx, c);
  const head: L = {
    en: `${c.name} needs about ${c.waterNeedMm} mm of water over its ~${c.seasonDays}-day season (FAO EcoCrop's lowest optimal rainfall for the crop).`,
    ar: `يحتاج ${cropName(c.id, "ar")} نحو ${c.waterNeedMm} ملم ماء خلال موسمه (~${c.seasonDays} يومًا) (أدنى مطر مثالي للمحصول في قاعدة بيانات الفاو EcoCrop).`,
  };
  if (rain === null) {
    return reply(ctx, "water", { en: `${head.en} Pick a place and I'll compare that with the rain NASA POWER recorded there.`, ar: `${head.ar} اختر مكانًا وسأقارن ذلك بالمطر الذي سجّلته ناسا POWER هناك.` }, [SRC.catalog]);
  }
  const gap = c.waterNeedMm - rain;
  const monthStr = { en: monthName({ ...ctx, lang: "en" }, ctx.startMonth), ar: monthName({ ...ctx, lang: "ar" }, ctx.startMonth) };
  return reply(ctx, "water", gap > 0
    ? { en: `${head.en} Average rainfall in a season planted in ${monthStr.en} is about ${r0(rain)} mm, so on average you are short by roughly ${r0(gap)} mm: plan irrigation or choose a lower-water crop. Dry years will be worse than this average.`, ar: `${head.ar} متوسط المطر في موسم يُزرع في ${monthStr.ar} نحو ${r0(rain)} ملم، فالنقص في المتوسط نحو ${r0(gap)} ملم: خطّط للري أو اختر محصولًا أقل استهلاكًا للماء. السنوات الجافة ستكون أسوأ من هذا المتوسط.` }
    : { en: `${head.en} Average rainfall in a season planted in ${monthStr.en} is about ${r0(rain)} mm, which covers it on average. Rain is uneven though: dry years and the timing of rain still matter, so check the worst seasons, not only the average.`, ar: `${head.ar} متوسط المطر في موسم يُزرع في ${monthStr.ar} نحو ${r0(rain)} ملم وهو يغطي الاحتياج في المتوسط. لكن المطر غير منتظم: السنوات الجافة وتوقيت المطر مهمان، فانظر إلى أسوأ المواسم لا المتوسط فقط.` },
  [SRC.catalog, SRC.power]);
}

function roiAnswer(ctx: AssistantContext, crops: Crop[]): Reply {
  const c = crops[0];
  if (!c) {
    return reply(ctx, "roi", {
      en: "How the cost tracker works, per hectare: revenue = yield × price; net = revenue − cost; ROI % = net ÷ cost × 100. Break-even price = cost ÷ yield (the lowest price that covers your cost). Break-even yield = cost ÷ price. Name a crop (for example: ROI of potato) and I'll show its numbers. The catalog values are illustrative: replace them with your own yields, prices and costs.",
      ar: "طريقة عمل متتبّع التكاليف لكل هكتار: الإيراد = الإنتاج × السعر؛ الصافي = الإيراد − التكلفة؛ العائد % = الصافي ÷ التكلفة × 100. سعر التعادل = التكلفة ÷ الإنتاج (أدنى سعر يغطي تكلفتك). إنتاج التعادل = التكلفة ÷ السعر. اذكر محصولًا (مثلًا: عائد البطاطس) وسأعرض أرقامه. قيم الكتالوج توضيحية: استبدلها بإنتاجك وأسعارك وتكاليفك.",
    }, [SRC.built]);
  }
  const name = { en: c.name, ar: cropName(c.id, "ar") };
  const e = cropEcon(c);
  if (!hasEconomics(c) || !e) {
    return reply(ctx, "roi", {
      en: `${name.en}: yield, price and cost are not available in the catalogue, so I can't show its return. Enter your own yield, price and costs in the Costs tab and it will compute net, ROI and break-even for you.`,
      ar: `${name.ar}: الإنتاج والسعر والتكلفة غير متاحة في الكتالوج، فلا أستطيع عرض عائده. أدخل إنتاجك وسعرك وتكاليفك في تبويب التكاليف وسيحسب الصافي والعائد ونقطة التعادل.`,
    }, [SRC.econ]);
  }
  return reply(ctx, "roi", {
    en: `${name.en}, per hectare (illustrative catalog values): revenue ${ctx.money(e.revenue)}, cost ${ctx.money(e.totalCost)}, net ${ctx.money(e.net)}${e.roiPct !== null ? `, ROI ${r0(e.roiPct)}%` : ""}. Break-even price ${e.breakEvenPrice !== null ? ctx.money(e.breakEvenPrice) : "n/a"}/t at ${c.yieldTHa} t/ha; break-even yield ${e.breakEvenYield !== null ? r1(e.breakEvenYield) : "n/a"} t/ha at ${ctx.money(c.priceUsdPerT)}/t. Use your own local prices before deciding.`,
    ar: `${name.ar} لكل هكتار (قيم توضيحية من الكتالوج): الإيراد ${ctx.money(e.revenue)}، التكلفة ${ctx.money(e.totalCost)}، الصافي ${ctx.money(e.net)}${e.roiPct !== null ? `، العائد ${r0(e.roiPct)}٪` : ""}. سعر التعادل ${e.breakEvenPrice !== null ? ctx.money(e.breakEvenPrice) : "غير متاح"}/طن عند ${c.yieldTHa} طن/هكتار؛ إنتاج التعادل ${e.breakEvenYield !== null ? r1(e.breakEvenYield) : "غير متاح"} طن/هكتار عند ${ctx.money(c.priceUsdPerT)}/طن. استخدم أسعارك المحلية قبل أي قرار.`,
  }, [SRC.econ]);
}

function forecastAnswer(ctx: AssistantContext): Reply {
  if (!ctx.location) return needPlace(ctx, "forecast");
  if (!ctx.forecast?.length) return reply(ctx, "forecast", { en: "The 7-day forecast for that place is not available right now. Try again in a minute.", ar: "توقعات الأيام السبعة لذلك المكان غير متاحة الآن. حاول بعد دقيقة." }, []);
  const d = ctx.forecast;
  const maxs = d.map((x) => x.tMax).filter((x): x is number => x !== null);
  const mins = d.map((x) => x.tMin).filter((x): x is number => x !== null);
  const rain = d.map((x) => x.rainMm ?? 0);
  const wetDays = d.filter((x) => (x.rainMm ?? 0) >= 1).length;
  const total = rain.reduce((s, v) => s + v, 0);
  const rng = maxs.length && mins.length ? { lo: r0(Math.min(...mins)), hi: r0(Math.max(...maxs)) } : null;
  const frost = mins.length && Math.min(...mins) <= 2;
  return reply(ctx, "forecast", {
    en: `Next ${d.length} days: ${rng ? `temperatures from ${rng.lo} to ${rng.hi} °C; ` : ""}about ${r0(total)} mm of rain in total, on ${wetDays} day${wetDays === 1 ? "" : "s"} with 1 mm or more.${frost ? " Nights near or below 2 °C: protect frost-sensitive crops." : ""}`,
    ar: `الأيام ${d.length} القادمة: ${rng ? `الحرارة من ${rng.lo} إلى ${rng.hi} °م؛ ` : ""}نحو ${r0(total)} ملم مطر إجمالًا، في ${wetDays} يوم/أيام بمقدار 1 ملم فأكثر.${frost ? " ليالٍ قرب 2 °م أو أقل: احمِ المحاصيل الحساسة للصقيع." : ""}`,
  }, [SRC.meteo]);
}

function rankingAnswer(ctx: AssistantContext): Reply {
  if (!ctx.strategies.length) return ctx.location ? climateLoading(ctx, "ranking") : needPlace(ctx, "ranking");
  const top = [...ctx.strategies].sort((a, b) => b.scores.overall - a.scores.overall)[0];
  const seq = top.sequence.map(cropLabel).join(" → ");
  const conf = { low: { en: "low", ar: "منخفضة" }, medium: { en: "medium", ar: "متوسطة" }, high: { en: "high", ar: "مرتفعة" } }[top.confidence];
  // Same names as the strategy entries show (messages/ar.json results.strategy).
  const labelAr: Record<Strategy["id"], string> = { current: "خطتك الحالية", soil: "باني التربة", water: "موفّر المياه", income: "دخل متنوع", balanced: "متوازنة (أولوياتك)" };
  const bare = (s: string | undefined) => s?.replace(/\.\s*$/, "");
  const n = top.sequence.length;
  const span = { en: n === 1 ? "One-season net" : `Net over ${n} seasons`, ar: n === 1 ? "صافي موسم واحد" : n === 2 ? "صافي موسمين" : `صافي ${n} مواسم` };
  const net = top.netUsdHa === null
    ? { en: `${span.en}: not available (a crop in it has no catalogue yield or price).`, ar: `${span.ar}: غير متاح (أحد محاصيلها بلا إنتاج أو سعر في الكتالوج).` }
    : { en: `${span.en}: about ${ctx.money(top.netUsdHa)} per hectare (illustrative).`, ar: `${span.ar}: نحو ${ctx.money(top.netUsdHa)} للهكتار (توضيحي).` };
  return reply(ctx, "ranking", {
    en: `With your current priorities, "${top.label}" scores highest overall (${r0(top.scores.overall)}/100): ${seq}. ${net.en} Confidence: ${conf.en}. Why: ${bare(top.why[0]) ?? "see the card"}. A gap to remember: ${bare(top.gaps[0]) ?? "no local soil test yet"}. Change what matters most (Low, Medium, High) to see the ranking change.`,
    ar: `بحسب أولوياتك الحالية، تحصل استراتيجية «${labelAr[top.id]}» على أعلى درجة إجمالية (${r0(top.scores.overall)}/100): ${seq}. ${net.ar} الثقة: ${conf.ar}. السبب (بالإنجليزية): ${bare(top.why[0]) ?? "راجع البطاقة"}. ثغرة يجب تذكّرها (بالإنجليزية): ${bare(top.gaps[0]) ?? "لا يوجد تحليل تربة محلي بعد"}. غيّر ما يهمك أكثر (منخفض، متوسط، مرتفع) لترى التصنيف يتغيّر.`,
  }, [SRC.engine, SRC.catalog, SRC.econ]);
}

function glossaryAnswer(ctx: AssistantContext, q: string): Reply | null {
  const map: [string, string[]][] = [
    ["et", ["evapotranspiration", "what is et$", "et$", "تبخر"]],
    ["ndvi", ["ndvi", "vegetation index", "greenness", "مؤشر النبات"]],
    ["soil moisture anomaly", ["soil moisture", "رطوبه التربه"]],
    ["frost risk", ["frost", "freeze", "صقيع"]],
    ["satellite vs ground data", ["satellite vs", "ground data", "how accurate", "can i trust", "دقه"]],
  ];
  const hit = map.find(([, words]) => words.some((w) => hasKeyword(q, w)));
  if (!hit) return null;
  const text = ar(ctx) ? GLOSSARY_AR[hit[0]] : GLOSSARY[hit[0]];
  return { intent: "glossary", text, sources: [SRC.glossary], suggestions: SUGGEST[ar(ctx) ? "ar" : "en"].slice(0, 3) };
}

// ---------- main ----------
export function answer(question: string, ctx: AssistantContext): Reply {
  const q = normalize(question);
  if (!q) return reply(ctx, "empty", { en: "Type a question about your crops, soil, water, costs or the weather.", ar: "اكتب سؤالًا عن محاصيلك أو تربتك أو مياهك أو تكاليفك أو الطقس." }, []);

  // Refusals come first, whatever else the question mentions.
  if (isDosing(q)) return reply(ctx, "dosing", DECLINE_DOSING, [SRC.built]);
  if (isOverride(q)) return reply(ctx, "guarantee", DECLINE_GUARANTEE, []);

  const crops = findCrops(question);
  if (crops.length === 2 && isCompare(q)) return reply(ctx, "compare", compareCrops(crops[0], crops[1], ctx.money), [SRC.catalog, SRC.econ]);
  if (crops.length && FERTILITY_WORDS.some((w) => hasKeyword(q, w))) return reply(ctx, "fertility", fertilityAnswer(crops[0]), [SRC.fertility]);
  if (isCalendar(q)) {
    if (!ctx.location) return needPlace(ctx, "calendar");
    if (!ctx.climate) return climateLoading(ctx, "calendar");
    const crop = crops[0] ?? CROPS.find((c) => c.id === ctx.strategies[0]?.sequence[0]);
    return crop ? reply(ctx, "calendar", calendarFor(crop, ctx.climate), [SRC.power, SRC.catalog]) : reply(ctx, "calendar", CALENDAR_NEEDS_CROP, []);
  }
  const ranked = INTENTS.map((i) => ({ id: i.id, s: score(q, i) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  let intent = ranked[0]?.id;
  // A bare crop name ("wheat") is a crop question; "water" + crop stays a water question.
  if (!intent && crops.length) intent = "crop";
  if (intent === "greeting" && crops.length) intent = "crop";

  switch (intent) {
    case "greeting":
      return reply(ctx, "greeting", {
        en: "Hi, I'm Atlas, a free helper that works from rules and the app's own data (no AI, no cost, nothing you type leaves your device). Ask me about crops, rotations, soil, water, costs and ROI, climate for your place, or the weather this week.",
        ar: "أهلًا، أنا أطلس، مساعد مجاني يعمل بقواعد وببيانات التطبيق نفسه (بلا ذكاء اصطناعي ولا تكلفة، ولا يغادر جهازك أي شيء تكتبه). اسألني عن المحاصيل والدورات الزراعية والتربة والمياه والتكاليف والعوائد ومناخ مكانك أو طقس هذا الأسبوع.",
      }, []);
    case "glossary": { const g = glossaryAnswer(ctx, q); if (g) return g; break; }
    case "forecast": return forecastAnswer(ctx);
    case "roi": return roiAnswer(ctx, crops);
    case "water": return waterAnswer(ctx, crops);
    case "climate": return climateSummary(ctx);
    case "crop": {
      if (crops.length === 2) {
        return reply(ctx, "crop", { en: `${cropCard(ctx, crops[0]).en}\n\n${cropCard(ctx, crops[1]).en}`, ar: `${cropCard(ctx, crops[0]).ar}\n\n${cropCard(ctx, crops[1]).ar}` }, [SRC.catalog, SRC.econ]);
      }
      return reply(ctx, "crop", cropCard(ctx, crops[0]), [SRC.catalog, SRC.econ]);
    }
    case "nfix": {
      const list = CROPS.filter((c) => c.nFixing);
      return reply(ctx, "nfix", {
        en: `Nitrogen-fixing crops in the catalog: ${list.map((c) => c.name).join(", ")}. Legumes host bacteria that turn air nitrogen into a form the next crop can use, which is why a legume between cereals helps soil health. I can't give fertiliser rates: use a local soil test and an extension officer for that.`,
        ar: `المحاصيل المثبّتة للنيتروجين في الكتالوج: ${list.map((c) => c.aliases?.find((a) => /[؀-ۿ]/.test(a)) ?? c.name).join("، ")}. البقوليات تستضيف بكتيريا تحوّل نيتروجين الهواء إلى صورة يستفيد منها المحصول التالي، ولهذا يفيد وجود بقوليات بين الحبوب في صحة التربة. لا أستطيع إعطاء معدلات تسميد: استعن بتحليل تربة محلي ومرشد زراعي.`,
      }, [SRC.catalog, SRC.built]);
    }
    case "soil": {
      const texture = textureAnswer(q);
      if (texture) return reply(ctx, "soil", texture, [SRC.texture]);
      const t = SOILS.find((s) => s.words.some((w) => hasKeyword(q, w)));
      if (t) return reply(ctx, "soil", { en: t.en, ar: t.ar }, [SRC.built]);
      return reply(ctx, "soil", {
        en: "Healthy soil comes from keeping roots in the ground, covering it, and varying what you grow. Habits that help: rotate plant families, include a legume, keep crop residue, avoid bare soil, add compost where you can. Soil types: ask me about sandy, clay, silt, loam or saline soil. Satellites cannot see soil chemistry: a local soil test beats any map, and I can't recommend chemical doses.",
        ar: "التربة الصحية تنتج عن إبقاء الجذور في الأرض وتغطيتها وتنويع ما تزرع. عادات مفيدة: ناوِب بين العائلات النباتية، وأدرج بقوليات، وأبقِ مخلفات المحصول، وتجنّب التربة العارية، وأضف كمبوست حيثما أمكن. أنواع التربة: اسألني عن الرملية أو الطينية أو الطميية أو اللومية أو المالحة. الأقمار الصناعية لا ترى كيمياء التربة: تحليل التربة المحلي أفضل من أي خريطة، ولا أستطيع التوصية بجرعات كيميائية.",
      }, [SRC.built]);
    }
    case "rotation":
      return reply(ctx, "rotation", {
        en: "Rotation means changing what you grow on a field from season to season. Why it helps: it breaks pest and disease cycles, spreads water and nutrient demand across different root depths, and lets legumes feed the next crop. Rules of thumb: don't repeat the same family back to back, put a legume after a hungry cereal, and mix deep and shallow roots. Open the Rotations tab and I'll score your plan against alternatives for your place.",
        ar: "التناوب يعني تغيير ما تزرعه في الحقل من موسم إلى آخر. فائدته: يكسر دورات الآفات والأمراض، ويوزّع الطلب على الماء والعناصر عبر أعماق جذور مختلفة، ويتيح للبقوليات تغذية المحصول التالي. قواعد عملية: لا تكرّر العائلة نفسها متتاليةً، وضع بقوليات بعد حبوب شرهة، ونوّع بين الجذور العميقة والسطحية. افتح تبويب الدورات وسأقيّم خطتك مقابل بدائل لمكانك.",
      }, [SRC.built, SRC.engine]);
    case "ranking": return rankingAnswer(ctx);
    case "sources":
      return reply(ctx, "sources", {
        en: "I'm a rule-based helper, not an AI model, so I only say what is built into the app or computed from its data. Data sources: NASA POWER (24 years of monthly temperature, rain and sunlight), NASA GIBS (satellite imagery on the globe), Open-Meteo (place search and the 7-day forecast), ExchangeRate-API (currency rates), and the FAO EcoCrop database (temperature, rain and season limits for each crop). Crop yields, prices and costs in the catalog are illustrative placeholders, not market data, and most crops have none.",
        ar: "أنا مساعد قائم على قواعد وليس نموذج ذكاء اصطناعي، لذلك أقول فقط ما هو مضمّن في التطبيق أو محسوب من بياناته. مصادر البيانات: ناسا POWER (24 سنة من الحرارة والمطر والإشعاع الشهري)، وناسا GIBS (صور الأقمار الصناعية على الكرة)، وOpen-Meteo (البحث عن الأماكن وتوقعات 7 أيام)، وExchangeRate-API (أسعار العملات)، وقاعدة بيانات الفاو EcoCrop (حدود الحرارة والمطر والموسم لكل محصول). إنتاجية المحاصيل وأسعارها وتكاليفها في الكتالوج قيم توضيحية وليست بيانات سوق، ومعظم المحاصيل بلا قيم.",
      }, []);
    case "howto":
      return reply(ctx, "howto", {
        en: "1) Search a place, tap Find my location, or tap the globe. 2) In Rotations, set your past crops and your plan (one to five seasons). 3) Set what matters most: Low, Medium or High. 4) Compare the strategy cards: scores, likely range, cost and ROI in your currency. 5) Switch the 3D globe to a 2D map or add a NASA layer from the top bar.",
        ar: "١) ابحث عن مكان أو اضغط «حدّد موقعي» أو المس الكرة. ٢) في تبويب الدورات حدّد محاصيلك السابقة وخطتك (من موسم إلى خمسة مواسم). ٣) حدّد ما يهمك أكثر: منخفض أو متوسط أو مرتفع. ٤) قارن بطاقات الاستراتيجيات: الدرجات والنطاق المحتمل والتكلفة والعائد بعملتك. ٥) بدّل الكرة ثلاثية الأبعاد إلى خريطة ثنائية أو أضف طبقة ناسا من الشريط العلوي.",
      }, []);
  }

  return reply(ctx, "fallback", {
    en: "I didn't catch that. I can help with crops (try a crop name), rotations, soil types, water needs, costs and ROI, climate for your place, and the weather this week. Pick one of the suggestions below, or rephrase.",
    ar: "لم أفهم سؤالك. أستطيع المساعدة في المحاصيل (جرّب اسم محصول) والدورات الزراعية وأنواع التربة واحتياجات المياه والتكاليف والعوائد ومناخ مكانك وطقس هذا الأسبوع. اختر أحد الاقتراحات أدناه أو أعد الصياغة.",
  }, [], SUGGEST[ar(ctx) ? "ar" : "en"]);
}
