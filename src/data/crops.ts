import type { Crop, Family } from "@/lib/rotation/types";
import ecocrop from "./ecocrop.json";

/**
 * The crop library.
 *
 * - Temperature limits, rainfall range and crop-cycle length come from the FAO EcoCrop database
 *   (src/data/ecocrop.json, built by scripts/import-ecocrop.mjs). Each crop names its EcoPort record.
 * - Family, nitrogen fixing and residue are FieldShift's own plain classification, stated as such.
 * - Yield, price and cost exist only for the ten starter crops, and they are ILLUSTRATIVE.
 *   Every other crop has none ("not available"): the farmer enters their own in the Costs tab.
 */

const ILLUSTRATIVE_ECON =
  "ILLUSTRATIVE starter values for the demo (yield, price and cost per hectare). Not market data: replace them with local numbers.";
const CLASSIFICATION =
  "Family: botanical family grouped for rotation planning. Nitrogen fixing: legumes (Fabaceae) with rhizobia. Residue: FieldShift's qualitative grouping by crop type (cereal and forage stubble high, vegetables and roots low), not a measurement.";

type Eco = (typeof ecocrop.records)[number];
const ECO = new Map<number, Eco>(ecocrop.records.map((r) => [r.code, r]));

interface Def {
  id: string; name: string; eco: number; family: Family; nFixing?: boolean; residue: Crop["residue"];
  /** Names in other languages, in this order: es | fr | pt | ru | tr | id | sw | zh | hi | bn. First-pass, need native review. */
  n: string;
  ar: string;
  aliases?: string[];
  econ?: { yieldTHa: number; priceUsdPerT: number; costUsdHa: number };
}

const NAME_LOCALES = ["es", "fr", "pt", "ru", "tr", "id", "sw", "zh", "hi", "bn"] as const;

const DEFS: Def[] = [
  // ---- cereals
  { id: "wheat", name: "Wheat", eco: 2114, family: "cereal", residue: "high", ar: "قمح", aliases: ["wheat", "bread wheat"], econ: { yieldTHa: 4.0, priceUsdPerT: 260, costUsdHa: 650 },
    n: "Trigo|Blé|Trigo|Пшеница|Buğday|Gandum|Ngano|小麦|गेहूँ|গম" },
  { id: "durum", name: "Durum wheat", eco: 10582, family: "cereal", residue: "high", ar: "قمح قاسي", aliases: ["durum", "durum wheat", "pasta wheat", "قمح صلب", "قمح ديورم"],
    n: "Trigo duro|Blé dur|Trigo duro|Твёрдая пшеница|Makarnalık buğday|Gandum durum|Ngano ya durum|硬粒小麦|कठिया गेहूँ|ডুরাম গম" },
  { id: "maize", name: "Maize", eco: 2175, family: "cereal", residue: "high", ar: "ذرة شامية", aliases: ["maize", "corn", "ذرة"], econ: { yieldTHa: 6.5, priceUsdPerT: 220, costUsdHa: 900 },
    n: "Maíz|Maïs|Milho|Кукуруза|Mısır|Jagung|Mahindi|玉米|मक्का|ভুট্টা" },
  { id: "barley", name: "Barley", eco: 1232, family: "cereal", residue: "medium", ar: "شعير", aliases: ["barley"], econ: { yieldTHa: 3.6, priceUsdPerT: 230, costUsdHa: 560 },
    n: "Cebada|Orge|Cevada|Ячмень|Arpa|Jelai|Shayiri|大麦|जौ|যব" },
  { id: "sorghum", name: "Sorghum", eco: 48747, family: "cereal", residue: "high", ar: "ذرة رفيعة", aliases: ["sorghum", "سورغم"], econ: { yieldTHa: 3.0, priceUsdPerT: 210, costUsdHa: 480 },
    n: "Sorgo|Sorgho|Sorgo|Сорго|Sorgum|Sorgum|Mtama|高粱|ज्वार|জোয়ার" },
  { id: "rice", name: "Rice", eco: 1574, family: "cereal", residue: "high", ar: "أرز", aliases: ["rice", "paddy", "رز"],
    n: "Arroz|Riz|Arroz|Рис|Çeltik|Padi|Mpunga|水稻|धान|ধান" },
  { id: "pearlMillet", name: "Pearl millet", eco: 8418, family: "cereal", residue: "high", ar: "دخن لؤلؤي", aliases: ["pearl millet", "millet", "bajra", "دخن"],
    n: "Mijo perla|Mil à chandelle|Milheto|Жемчужное просо|İnci darı|Jewawut mutiara|Uwele|珍珠粟|बाजरा|বাজরা" },
  { id: "fingerMillet", name: "Finger millet", eco: 5657, family: "cereal", residue: "medium", ar: "دخن إصبعي", aliases: ["finger millet", "ragi", "تليبون"],
    n: "Mijo africano|Éleusine|Capim-pé-de-galinha|Элевсина|Parmak darı|Jewawut jari|Ulezi|龙爪稷|रागी|মারুয়া" },
  { id: "oats", name: "Oats", eco: 481, family: "cereal", residue: "medium", ar: "شوفان", aliases: ["oats", "oat"],
    n: "Avena|Avoine|Aveia|Овёс|Yulaf|Haver|Oti|燕麦|जई|যই" },
  { id: "rye", name: "Rye", eco: 1929, family: "cereal", residue: "high", ar: "شيلم", aliases: ["rye", "جاودار"],
    n: "Centeno|Seigle|Centeio|Рожь|Çavdar|Gandum hitam|Rai|黑麦|राई (अनाज)|রাই শস্য" },
  { id: "teff", name: "Teff", eco: 5746, family: "cereal", residue: "low", ar: "تيف", aliases: ["teff", "tef"],
    n: "Tef|Teff|Teff|Тэфф|Teff|Teff|Teff|苔麸|टेफ़|টেফ" },
  { id: "prosoMillet", name: "Proso millet", eco: 8280, family: "cereal", residue: "medium", ar: "دخن عادي", aliases: ["proso millet", "proso", "common millet"],
    n: "Mijo común|Millet commun|Painço|Просо|Darı|Jewawut proso|Uwele proso|黍|चीना|চীনা" },
  { id: "quinoa", name: "Quinoa", eco: 2509, family: "amaranth", residue: "low", ar: "كينوا", aliases: ["quinoa", "كينوا"],
    n: "Quinua|Quinoa|Quinoa|Киноа|Kinoa|Kinoa|Kwinoa|藜麦|क्विनोआ|কিনোয়া" },

  // ---- legumes
  { id: "soy", name: "Soybean", eco: 1150, family: "legume", nFixing: true, residue: "medium", ar: "فول الصويا", aliases: ["soy", "soya", "soybean", "soybeans", "صويا"], econ: { yieldTHa: 2.8, priceUsdPerT: 480, costUsdHa: 620 },
    n: "Soja|Soja|Soja|Соя|Soya|Kedelai|Soya|大豆|सोयाबीन|সয়াবিন" },
  { id: "chickpea", name: "Chickpea", eco: 2479, family: "legume", nFixing: true, residue: "low", ar: "حمص", aliases: ["chickpea", "chickpeas", "garbanzo"], econ: { yieldTHa: 1.6, priceUsdPerT: 650, costUsdHa: 450 },
    n: "Garbanzo|Pois chiche|Grão-de-bico|Нут|Nohut|Kacang arab|Dengu|鹰嘴豆|चना|ছোলা" },
  { id: "faba", name: "Faba bean", eco: 2146, family: "legume", nFixing: true, residue: "medium", ar: "فول", aliases: ["faba", "faba bean", "broad bean", "فول بلدي"], econ: { yieldTHa: 2.4, priceUsdPerT: 420, costUsdHa: 500 },
    n: "Haba|Fève|Fava|Конские бобы|Bakla|Kacang fava|Maharagwe fava|蚕豆|बाकला|বাকলা" },
  { id: "lentil", name: "Lentil", eco: 7209, family: "legume", nFixing: true, residue: "low", ar: "عدس", aliases: ["lentil", "lentils"],
    n: "Lenteja|Lentille|Lentilha|Чечевица|Mercimek|Lentil|Adesi|小扁豆|मसूर|মসুর" },
  { id: "bean", name: "Common bean", eco: 1668, family: "legume", nFixing: true, residue: "low", ar: "فاصوليا", aliases: ["bean", "beans", "common bean", "dry bean", "kidney bean", "فاصولياء"],
    n: "Frijol|Haricot|Feijão|Фасоль|Fasulye|Kacang buncis|Maharagwe|菜豆|राजमा|রাজমা" },
  { id: "cowpea", name: "Cowpea", eco: 2153, family: "legume", nFixing: true, residue: "medium", ar: "لوبيا", aliases: ["cowpea", "cowpeas", "black-eyed pea"],
    n: "Caupí|Niébé|Feijão-caupi|Вигна|Börülce|Kacang tunggak|Kunde|豇豆|लोबिया|বরবটি" },
  { id: "pea", name: "Pea", eco: 1721, family: "legume", nFixing: true, residue: "low", ar: "بازلاء", aliases: ["pea", "peas", "field pea", "بسلة"],
    n: "Guisante|Pois|Ervilha|Горох|Bezelye|Kacang polong|Njegere|豌豆|मटर|মটর" },
  { id: "groundnut", name: "Groundnut", eco: 2199, family: "legume", nFixing: true, residue: "low", ar: "فول سوداني", aliases: ["groundnut", "groundnuts", "peanut", "peanuts"],
    n: "Maní|Arachide|Amendoim|Арахис|Yer fıstığı|Kacang tanah|Karanga|花生|मूँगफली|চিনাবাদাম" },
  { id: "mungBean", name: "Mung bean", eco: 2150, family: "legume", nFixing: true, residue: "low", ar: "ماش", aliases: ["mung bean", "mung", "green gram"],
    n: "Frijol mungo|Haricot mungo|Feijão-mungo|Маш|Maş fasulyesi|Kacang hijau|Choroko|绿豆|मूँग|মুগ" },
  { id: "pigeonPea", name: "Pigeon pea", eco: 576, family: "legume", nFixing: true, residue: "high", ar: "بازلاء هندية", aliases: ["pigeon pea", "pigeonpea", "tur", "arhar"],
    n: "Guandú|Pois d'Angole|Feijão-guandu|Каянус|Güvercin bezelyesi|Kacang gude|Mbaazi|木豆|अरहर|অড়হর" },
  { id: "lupin", name: "White lupin", eco: 7431, family: "legume", nFixing: true, residue: "medium", ar: "ترمس", aliases: ["lupin", "lupine", "white lupin"],
    n: "Altramuz|Lupin blanc|Tremoço|Люпин белый|Termiye|Lupin putih|Lupini|白羽扇豆|सफ़ेद ल्यूपिन|সাদা লুপিন" },
  { id: "bambara", name: "Bambara groundnut", eco: 10830, family: "legume", nFixing: true, residue: "low", ar: "فول بامبارا", aliases: ["bambara", "bambara groundnut", "bambara bean"],
    n: "Maní bambara|Voandzou|Feijão-bambara|Бамбарский орех|Bambara fıstığı|Kacang bogor|Njugu mawe|班巴拉豆|बम्बारा मूँगफली|বামবারা বাদাম" },

  // ---- oilseeds
  { id: "canola", name: "Canola", eco: 549, family: "brassica", residue: "medium", ar: "كانولا", aliases: ["canola", "rapeseed", "oilseed rape", "لفت زيتي"], econ: { yieldTHa: 2.4, priceUsdPerT: 520, costUsdHa: 640 },
    n: "Colza|Colza|Canola|Рапс|Kanola|Kanola|Kanola|油菜|तोरिया|ক্যানোলা" },
  { id: "sunflower", name: "Sunflower", eco: 1191, family: "oilseed", residue: "high", ar: "عباد الشمس", aliases: ["sunflower", "دوار الشمس"],
    n: "Girasol|Tournesol|Girassol|Подсолнечник|Ayçiçeği|Bunga matahari|Alizeti|向日葵|सूरजमुखी|সূর্যমুখী" },
  { id: "sesame", name: "Sesame", eco: 1937, family: "oilseed", residue: "medium", ar: "سمسم", aliases: ["sesame", "simsim"],
    n: "Sésamo|Sésame|Gergelim|Кунжут|Susam|Wijen|Ufuta|芝麻|तिल|তিল" },
  { id: "safflower", name: "Safflower", eco: 2514, family: "oilseed", residue: "medium", ar: "قرطم", aliases: ["safflower", "عصفر"],
    n: "Cártamo|Carthame|Cártamo|Сафлор|Aspir|Kasumba|Kasumba|红花|कुसुम|কুসুম ফুল" },
  { id: "linseed", name: "Linseed (flax)", eco: 7336, family: "oilseed", residue: "medium", ar: "كتان", aliases: ["linseed", "flax", "flaxseed"],
    n: "Lino|Lin|Linhaça|Лён|Keten|Biji rami|Kitani|亚麻|अलसी|তিসি" },

  // ---- roots and tubers
  { id: "potato", name: "Potato", eco: 1971, family: "solanum", residue: "low", ar: "بطاطس", aliases: ["potato", "potatoes", "بطاطا"], econ: { yieldTHa: 30, priceUsdPerT: 180, costUsdHa: 3200 },
    n: "Papa|Pomme de terre|Batata|Картофель|Patates|Kentang|Viazi mviringo|马铃薯|आलू|আলু" },
  { id: "sweetPotato", name: "Sweet potato", eco: 1265, family: "root", residue: "low", ar: "بطاطا حلوة", aliases: ["sweet potato", "sweet potatoes", "بطاطا حلوه"],
    n: "Batata|Patate douce|Batata-doce|Батат|Tatlı patates|Ubi jalar|Viazi vitamu|甘薯|शकरकंद|মিষ্টি আলু" },
  { id: "cassava", name: "Cassava", eco: 1420, family: "root", residue: "medium", ar: "كسافا", aliases: ["cassava", "manioc", "yuca", "منيهوت"],
    n: "Yuca|Manioc|Mandioca|Маниок|Manyok|Singkong|Muhogo|木薯|कसावा|কাসাভা" },
  { id: "sugarBeet", name: "Sugar beet", eco: 48742, family: "amaranth", residue: "low", ar: "بنجر السكر", aliases: ["sugar beet", "sugarbeet", "beet", "شمندر سكري", "بنجر"],
    n: "Remolacha azucarera|Betterave sucrière|Beterraba-sacarina|Сахарная свёкла|Şeker pancarı|Bit gula|Kiazisukari|甜菜|शुगर बीट|সুগার বিট" },
  { id: "carrot", name: "Carrot", eco: 871, family: "root", residue: "low", ar: "جزر", aliases: ["carrot", "carrots"],
    n: "Zanahoria|Carotte|Cenoura|Морковь|Havuç|Wortel|Karoti|胡萝卜|गाजर|গাজর" },

  // ---- vegetables
  { id: "spinach", name: "Spinach", eco: 1997, family: "amaranth", residue: "low", ar: "سبانخ", aliases: ["spinach"],
    n: "Espinaca|Épinard|Espinafre|Шпинат|Ispanak|Bayam|Spinachi|菠菜|पालक|পালং শাক" },
  { id: "tomato", name: "Tomato", eco: 1379, family: "solanum", residue: "low", ar: "طماطم", aliases: ["tomato", "tomatoes", "بندورة"],
    n: "Tomate|Tomate|Tomate|Томат|Domates|Tomat|Nyanya|番茄|टमाटर|টমেটো" },
  { id: "eggplant", name: "Eggplant", eco: 1965, family: "solanum", residue: "low", ar: "باذنجان", aliases: ["eggplant", "aubergine", "brinjal"],
    n: "Berenjena|Aubergine|Berinjela|Баклажан|Patlıcan|Terong|Biringanya|茄子|बैंगन|বেগুন" },
  { id: "pepper", name: "Pepper (sweet and chilli)", eco: 618, family: "solanum", residue: "low", ar: "فلفل", aliases: ["pepper", "peppers", "chilli", "capsicum", "sweet pepper"],
    n: "Pimiento|Poivron|Pimentão|Перец|Biber|Cabai|Pilipili hoho|辣椒|मिर्च|মরিচ" },
  { id: "cucumber", name: "Cucumber", eco: 817, family: "cucurbit", residue: "low", ar: "خيار", aliases: ["cucumber", "cucumbers"],
    n: "Pepino|Concombre|Pepino|Огурец|Salatalık|Mentimun|Tango|黄瓜|खीरा|শসা" },
  { id: "melon", name: "Melon", eco: 815, family: "cucurbit", residue: "low", ar: "شمام", aliases: ["melon", "melons", "cantaloupe", "muskmelon"],
    n: "Melón|Melon|Melão|Дыня|Kavun|Melon|Tikiti tamu|甜瓜|खरबूजा|খরমুজ" },
  { id: "pumpkin", name: "Pumpkin (butternut)", eco: 820, family: "cucurbit", residue: "low", ar: "قرع عسلي", aliases: ["pumpkin", "butternut", "squash", "winter squash", "قرع"],
    n: "Calabaza|Courge musquée|Abóbora|Тыква мускатная|Bal kabağı|Labu|Boga|南瓜|कद्दू|মিষ্টি কুমড়া" },
  { id: "zucchini", name: "Zucchini (summer squash)", eco: 821, family: "cucurbit", residue: "low", ar: "كوسة", aliases: ["zucchini", "courgette", "summer squash", "marrow", "كوسا"],
    n: "Calabacín|Courgette|Abobrinha|Кабачок|Sakız kabağı|Zukini|Zukini|西葫芦|ज़ुकीनी|জুকিনি" },
  { id: "cabbage", name: "Cabbage", eco: 554, family: "brassica", residue: "low", ar: "كرنب", aliases: ["cabbage", "ملفوف"],
    n: "Repollo|Chou|Repolho|Капуста|Lahana|Kubis|Kabichi|卷心菜|पत्ता गोभी|বাঁধাকপি" },
  { id: "cauliflower", name: "Cauliflower", eco: 553, family: "brassica", residue: "low", ar: "قرنبيط", aliases: ["cauliflower"],
    n: "Coliflor|Chou-fleur|Couve-flor|Цветная капуста|Karnabahar|Kembang kol|Koliflawa|花椰菜|फूलगोभी|ফুলকপি" },
  { id: "mustard", name: "Mustard", eco: 548, family: "brassica", residue: "medium", ar: "خردل", aliases: ["mustard", "indian mustard", "brown mustard"],
    n: "Mostaza|Moutarde brune|Mostarda|Горчица сарептская|Hardal|Sawi|Haradali|芥菜|राई (भूरी सरसों)|সরিষা" },
  { id: "onion", name: "Onion", eco: 364, family: "allium", residue: "low", ar: "بصل", aliases: ["onion", "onions"],
    n: "Cebolla|Oignon|Cebola|Лук репчатый|Soğan|Bawang bombay|Kitunguu|洋葱|प्याज़|পেঁয়াজ" },
  { id: "garlic", name: "Garlic", eco: 367, family: "allium", residue: "low", ar: "ثوم", aliases: ["garlic"],
    n: "Ajo|Ail|Alho|Чеснок|Sarımsak|Bawang putih|Kitunguu saumu|大蒜|लहसुन|রসুন" },
  { id: "okra", name: "Okra", eco: 289, family: "mallow", residue: "medium", ar: "بامية", aliases: ["okra", "bhindi", "gumbo"],
    n: "Quimbombó|Gombo|Quiabo|Бамия|Bamya|Okra|Bamia|秋葵|भिंडी|ঢেঁড়স" },

  // ---- fibre and forage
  { id: "cotton", name: "Cotton", eco: 1160, family: "mallow", residue: "high", ar: "قطن", aliases: ["cotton"],
    n: "Algodón|Coton|Algodão|Хлопчатник|Pamuk|Kapas|Pamba|棉花|कपास|তুলা" },
  { id: "alfalfa", name: "Alfalfa (forage)", eco: 1428, family: "forage", nFixing: true, residue: "high", ar: "برسيم حجازي", aliases: ["alfalfa", "lucerne", "فصة", "قضب"], econ: { yieldTHa: 9, priceUsdPerT: 190, costUsdHa: 800 },
    n: "Alfalfa|Luzerne|Alfafa|Люцерна|Yonca|Alfalfa|Alfalfa|苜蓿|रिज़का|আলফালফা" },
  { id: "berseem", name: "Berseem clover (forage)", eco: 10522, family: "forage", nFixing: true, residue: "medium", ar: "برسيم مصري", aliases: ["berseem", "egyptian clover", "berseem clover", "برسيم"],
    n: "Trébol de Alejandría|Trèfle d'Alexandrie|Trevo-de-alexandria|Клевер александрийский|İskenderiye üçgülü|Semanggi Mesir|Klova ya Misri|埃及三叶草|बरसीम|বারসিম" },
];

function build(d: Def): Crop {
  const e = ECO.get(d.eco);
  if (!e) throw new Error(`crops.ts: EcoPort ${d.eco} (${d.id}) is not in ecocrop.json`);
  const names = Object.fromEntries(d.n.split("|").map((v, i) => [NAME_LOCALES[i], v.trim()]));
  names.ar = d.ar;
  const cycle = `${e.gMin}–${e.gMax}`;
  return {
    id: d.id, name: d.name, scientific: e.scientific, ecoPort: e.code, family: d.family, nFixing: !!d.nFixing, residue: d.residue,
    tMin: e.tMin, tOptLow: e.tOptLow, tOptHigh: e.tOptHigh, tMax: e.tMax, killC: e.killC,
    waterNeedMm: e.rOptLow,
    rainMm: { min: e.rMin, optLow: e.rOptLow, optHigh: e.rOptHigh, max: e.rMax },
    cycleDays: [e.gMin, e.gMax],
    seasonDays: Math.round((e.gMin + e.gMax) / 2),
    yieldTHa: d.econ?.yieldTHa ?? null, priceUsdPerT: d.econ?.priceUsdPerT ?? null, costUsdHa: d.econ?.costUsdHa ?? null,
    aliases: [...new Set([d.ar, ...(d.aliases ?? []), d.name.toLowerCase().replace(/\s*\(.*\)/, "")])],
    names,
    source: `Temperature, rainfall and crop cycle: FAO EcoCrop, EcoPort ${e.code} (${e.scientific}). Water need = EcoCrop's lowest optimal rainfall over the crop cycle (ROPMN, ${e.rOptLow} mm). Season = midpoint of the EcoCrop cycle (${cycle} days). ${CLASSIFICATION}`,
    economicsSource: d.econ ? ILLUSTRATIVE_ECON : null,
  };
}

export const CROPS: Crop[] = DEFS.map(build);
export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]));
/** Source line for the EcoCrop extract, for the credits. */
export const ECOCROP_SOURCE = ecocrop.source;

export { hasEconomics } from "@/lib/rotation/engine";

/** The crop's name for the page language. Falls back to English. */
export function cropName(id: string, locale: string): string {
  const c = CROP_BY_ID.get(id);
  if (!c) return id;
  return c.names?.[locale] ?? c.name;
}
