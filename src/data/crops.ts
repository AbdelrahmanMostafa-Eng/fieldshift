import type { Crop, CropIcon, Family, SoilTexture } from "@/lib/rotation/types";
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
  "Family: botanical family grouped for rotation planning. Nitrogen fixing: legumes (Fabaceae) with rhizobia. Residue: FieldShift's qualitative grouping by crop type (cereal and forage stubble high, vegetables and roots low), not a measurement. Soil texture: EcoCrop TEXT (best) and TEXTR (tolerated).";

type Eco = (typeof ecocrop.records)[number];
const ECO = new Map<number, Eco>(ecocrop.records.map((r) => [r.code, r]));

interface Def {
  id: string; name: string; eco: number; family: Family; nFixing?: boolean; residue: Crop["residue"];
  /** Names in other languages, in this order: es | fr | pt | ru | tr | id | sw | zh | hi | bn. First-pass, need native review. */
  n: string;
  /** More names, in this order: ur | fa | vi | th | uk | de. First-pass, need native review. */
  m: string;
  icon: CropIcon;
  ar: string;
  aliases?: string[];
  econ?: { yieldTHa: number; priceUsdPerT: number; costUsdHa: number };
}

const NAME_LOCALES = ["es", "fr", "pt", "ru", "tr", "id", "sw", "zh", "hi", "bn"] as const;
const MORE_LOCALES = ["ur", "fa", "vi", "th", "uk", "de"] as const;

const DEFS: Def[] = [
  // ---- cereals
  { id: "wheat", icon: "grain", m: "گندم|گندم|Lúa mì|ข้าวสาลี|Пшениця|Weizen", name: "Wheat", eco: 2114, family: "cereal", residue: "high", ar: "قمح", aliases: ["wheat", "bread wheat"], econ: { yieldTHa: 4.0, priceUsdPerT: 260, costUsdHa: 650 },
    n: "Trigo|Blé|Trigo|Пшеница|Buğday|Gandum|Ngano|小麦|गेहूँ|গম" },
  { id: "durum", icon: "grain", m: "ڈیورم گندم|گندم دوروم|Lúa mì cứng|ข้าวสาลีดูรัม|Тверда пшениця|Hartweizen", name: "Durum wheat", eco: 10582, family: "cereal", residue: "high", ar: "قمح قاسي", aliases: ["durum", "durum wheat", "pasta wheat", "قمح صلب", "قمح ديورم"],
    n: "Trigo duro|Blé dur|Trigo duro|Твёрдая пшеница|Makarnalık buğday|Gandum durum|Ngano ya durum|硬粒小麦|कठिया गेहूँ|ডুরাম গম" },
  { id: "maize", icon: "maize", m: "مکئی|ذرت|Ngô|ข้าวโพด|Кукурудза|Mais", name: "Maize", eco: 2175, family: "cereal", residue: "high", ar: "ذرة شامية", aliases: ["maize", "corn", "ذرة"], econ: { yieldTHa: 6.5, priceUsdPerT: 220, costUsdHa: 900 },
    n: "Maíz|Maïs|Milho|Кукуруза|Mısır|Jagung|Mahindi|玉米|मक्का|ভুট্টা" },
  { id: "barley", icon: "grain", m: "جو|جو|Lúa mạch|ข้าวบาร์เลย์|Ячмінь|Gerste", name: "Barley", eco: 1232, family: "cereal", residue: "medium", ar: "شعير", aliases: ["barley"], econ: { yieldTHa: 3.6, priceUsdPerT: 230, costUsdHa: 560 },
    n: "Cebada|Orge|Cevada|Ячмень|Arpa|Jelai|Shayiri|大麦|जौ|যব" },
  { id: "sorghum", icon: "millet", m: "جوار|سورگوم|Cao lương|ข้าวฟ่าง|Сорго|Sorghum", name: "Sorghum", eco: 48747, family: "cereal", residue: "high", ar: "ذرة رفيعة", aliases: ["sorghum", "سورغم"], econ: { yieldTHa: 3.0, priceUsdPerT: 210, costUsdHa: 480 },
    n: "Sorgo|Sorgho|Sorgo|Сорго|Sorgum|Sorgum|Mtama|高粱|ज्वार|জোয়ার" },
  { id: "rice", icon: "rice", m: "چاول|برنج|Lúa|ข้าว|Рис|Reis", name: "Rice", eco: 1574, family: "cereal", residue: "high", ar: "أرز", aliases: ["rice", "paddy", "رز"],
    n: "Arroz|Riz|Arroz|Рис|Çeltik|Padi|Mpunga|水稻|धान|ধান" },
  { id: "pearlMillet", icon: "millet", m: "باجرہ|ارزن مرواریدی|Kê ngọc trai|ข้าวฟ่างไข่มุก|Просо перлове|Perlhirse", name: "Pearl millet", eco: 8418, family: "cereal", residue: "high", ar: "دخن لؤلؤي", aliases: ["pearl millet", "millet", "bajra", "دخن"],
    n: "Mijo perla|Mil à chandelle|Milheto|Жемчужное просо|İnci darı|Jewawut mutiara|Uwele|珍珠粟|बाजरा|বাজরা" },
  { id: "fingerMillet", icon: "millet", m: "راگی|ارزن انگشتی|Kê chân vịt|ข้าวฟ่างนิ้วมือ|Елевсина|Fingerhirse", name: "Finger millet", eco: 5657, family: "cereal", residue: "medium", ar: "دخن إصبعي", aliases: ["finger millet", "ragi", "تليبون"],
    n: "Mijo africano|Éleusine|Capim-pé-de-galinha|Элевсина|Parmak darı|Jewawut jari|Ulezi|龙爪稷|रागी|মারুয়া" },
  { id: "oats", icon: "grain", m: "جئی|جو دوسر|Yến mạch|ข้าวโอ๊ต|Овес|Hafer", name: "Oats", eco: 481, family: "cereal", residue: "medium", ar: "شوفان", aliases: ["oats", "oat"],
    n: "Avena|Avoine|Aveia|Овёс|Yulaf|Haver|Oti|燕麦|जई|যই" },
  { id: "rye", icon: "grain", m: "رائی (اناج)|چاودار|Lúa mạch đen|ข้าวไรย์|Жито|Roggen", name: "Rye", eco: 1929, family: "cereal", residue: "high", ar: "شيلم", aliases: ["rye", "جاودار"],
    n: "Centeno|Seigle|Centeio|Рожь|Çavdar|Gandum hitam|Rai|黑麦|राई (अनाज)|রাই শস্য" },
  { id: "teff", icon: "grain", m: "ٹیف|تف|Cỏ teff|เทฟ|Теф|Teff", name: "Teff", eco: 5746, family: "cereal", residue: "low", ar: "تيف", aliases: ["teff", "tef"],
    n: "Tef|Teff|Teff|Тэфф|Teff|Teff|Teff|苔麸|टेफ़|টেফ" },
  { id: "prosoMillet", icon: "millet", m: "چینا|ارزن معمولی|Kê|ข้าวฟ่างโปรโซ|Просо|Rispenhirse", name: "Proso millet", eco: 8280, family: "cereal", residue: "medium", ar: "دخن عادي", aliases: ["proso millet", "proso", "common millet"],
    n: "Mijo común|Millet commun|Painço|Просо|Darı|Jewawut proso|Uwele proso|黍|चीना|চীনা" },
  { id: "quinoa", icon: "millet", m: "کینوا|کینوا|Diêm mạch|คีนัว|Кіноа|Quinoa", name: "Quinoa", eco: 2509, family: "amaranth", residue: "low", ar: "كينوا", aliases: ["quinoa", "كينوا"],
    n: "Quinua|Quinoa|Quinoa|Киноа|Kinoa|Kinoa|Kwinoa|藜麦|क्विनोआ|কিনোয়া" },

  // ---- legumes
  { id: "soy", icon: "pod", m: "سویابین|سویا|Đậu nành|ถั่วเหลือง|Соя|Sojabohne", name: "Soybean", eco: 1150, family: "legume", nFixing: true, residue: "medium", ar: "فول الصويا", aliases: ["soy", "soya", "soybean", "soybeans", "صويا"], econ: { yieldTHa: 2.8, priceUsdPerT: 480, costUsdHa: 620 },
    n: "Soja|Soja|Soja|Соя|Soya|Kedelai|Soya|大豆|सोयाबीन|সয়াবিন" },
  { id: "chickpea", icon: "pod", m: "چنا|نخود|Đậu gà|ถั่วลูกไก่|Нут|Kichererbse", name: "Chickpea", eco: 2479, family: "legume", nFixing: true, residue: "low", ar: "حمص", aliases: ["chickpea", "chickpeas", "garbanzo"], econ: { yieldTHa: 1.6, priceUsdPerT: 650, costUsdHa: 450 },
    n: "Garbanzo|Pois chiche|Grão-de-bico|Нут|Nohut|Kacang arab|Dengu|鹰嘴豆|चना|ছোলা" },
  { id: "faba", icon: "pod", m: "باقلا|باقلا|Đậu răng ngựa|ถั่วปากอ้า|Кормові боби|Ackerbohne", name: "Faba bean", eco: 2146, family: "legume", nFixing: true, residue: "medium", ar: "فول", aliases: ["faba", "faba bean", "broad bean", "فول بلدي"], econ: { yieldTHa: 2.4, priceUsdPerT: 420, costUsdHa: 500 },
    n: "Haba|Fève|Fava|Конские бобы|Bakla|Kacang fava|Maharagwe fava|蚕豆|बाकला|বাকলা" },
  { id: "lentil", icon: "pod", m: "مسور|عدس|Đậu lăng|ถั่วเลนทิล|Сочевиця|Linse", name: "Lentil", eco: 7209, family: "legume", nFixing: true, residue: "low", ar: "عدس", aliases: ["lentil", "lentils"],
    n: "Lenteja|Lentille|Lentilha|Чечевица|Mercimek|Lentil|Adesi|小扁豆|मसूर|মসুর" },
  { id: "bean", icon: "pod", m: "راجما|لوبیا|Đậu thường|ถั่วแดง|Квасоля|Gartenbohne", name: "Common bean", eco: 1668, family: "legume", nFixing: true, residue: "low", ar: "فاصوليا", aliases: ["bean", "beans", "common bean", "dry bean", "kidney bean", "فاصولياء"],
    n: "Frijol|Haricot|Feijão|Фасоль|Fasulye|Kacang buncis|Maharagwe|菜豆|राजमा|রাজমা" },
  { id: "cowpea", icon: "pod", m: "لوبیا|لوبیا چشم‌بلبلی|Đậu đũa|ถั่วพุ่ม|Вігна|Augenbohne", name: "Cowpea", eco: 2153, family: "legume", nFixing: true, residue: "medium", ar: "لوبيا", aliases: ["cowpea", "cowpeas", "black-eyed pea"],
    n: "Caupí|Niébé|Feijão-caupi|Вигна|Börülce|Kacang tunggak|Kunde|豇豆|लोबिया|বরবটি" },
  { id: "pea", icon: "pod", m: "مٹر|نخود فرنگی|Đậu Hà Lan|ถั่วลันเตา|Горох|Erbse", name: "Pea", eco: 1721, family: "legume", nFixing: true, residue: "low", ar: "بازلاء", aliases: ["pea", "peas", "field pea", "بسلة"],
    n: "Guisante|Pois|Ervilha|Горох|Bezelye|Kacang polong|Njegere|豌豆|मटर|মটর" },
  { id: "groundnut", icon: "peanut", m: "مونگ پھلی|بادام‌زمینی|Lạc|ถั่วลิสง|Арахіс|Erdnuss", name: "Groundnut", eco: 2199, family: "legume", nFixing: true, residue: "low", ar: "فول سوداني", aliases: ["groundnut", "groundnuts", "peanut", "peanuts"],
    n: "Maní|Arachide|Amendoim|Арахис|Yer fıstığı|Kacang tanah|Karanga|花生|मूँगफली|চিনাবাদাম" },
  { id: "mungBean", icon: "pod", m: "مونگ|ماش|Đậu xanh|ถั่วเขียว|Маш|Mungbohne", name: "Mung bean", eco: 2150, family: "legume", nFixing: true, residue: "low", ar: "ماش", aliases: ["mung bean", "mung", "green gram"],
    n: "Frijol mungo|Haricot mungo|Feijão-mungo|Маш|Maş fasulyesi|Kacang hijau|Choroko|绿豆|मूँग|মুগ" },
  { id: "pigeonPea", icon: "pod", m: "ارہر|نخود کبوتر|Đậu săng|ถั่วมะแฮะ|Каянус|Straucherbse", name: "Pigeon pea", eco: 576, family: "legume", nFixing: true, residue: "high", ar: "بازلاء هندية", aliases: ["pigeon pea", "pigeonpea", "tur", "arhar"],
    n: "Guandú|Pois d'Angole|Feijão-guandu|Каянус|Güvercin bezelyesi|Kacang gude|Mbaazi|木豆|अरहर|অড়হর" },
  { id: "lupin", icon: "pod", m: "سفید لیوپن|لوپن سفید|Đậu lupin trắng|ถั่วลูพินขาว|Люпин білий|Weiße Lupine", name: "White lupin", eco: 7431, family: "legume", nFixing: true, residue: "medium", ar: "ترمس", aliases: ["lupin", "lupine", "white lupin"],
    n: "Altramuz|Lupin blanc|Tremoço|Люпин белый|Termiye|Lupin putih|Lupini|白羽扇豆|सफ़ेद ल्यूपिन|সাদা লুপিন" },
  { id: "bambara", icon: "peanut", m: "بمبارا مونگ پھلی|بادام‌زمینی بامبارا|Lạc Bambara|ถั่วบัมบารา|Бамбарський арахіс|Bambara-Erdnuss", name: "Bambara groundnut", eco: 10830, family: "legume", nFixing: true, residue: "low", ar: "فول بامبارا", aliases: ["bambara", "bambara groundnut", "bambara bean"],
    n: "Maní bambara|Voandzou|Feijão-bambara|Бамбарский орех|Bambara fıstığı|Kacang bogor|Njugu mawe|班巴拉豆|बम्बारा मूँगफली|বামবারা বাদাম" },

  // ---- oilseeds
  { id: "canola", icon: "flower4", m: "کینولا|کلزا|Cải dầu|คาโนลา|Ріпак|Raps", name: "Canola", eco: 549, family: "brassica", residue: "medium", ar: "كانولا", aliases: ["canola", "rapeseed", "oilseed rape", "لفت زيتي"], econ: { yieldTHa: 2.4, priceUsdPerT: 520, costUsdHa: 640 },
    n: "Colza|Colza|Canola|Рапс|Kanola|Kanola|Kanola|油菜|तोरिया|ক্যানোলা" },
  { id: "sunflower", icon: "sunflower", m: "سورج مکھی|آفتابگردان|Hướng dương|ทานตะวัน|Соняшник|Sonnenblume", name: "Sunflower", eco: 1191, family: "daisy", residue: "high", ar: "عباد الشمس", aliases: ["sunflower", "دوار الشمس"],
    n: "Girasol|Tournesol|Girassol|Подсолнечник|Ayçiçeği|Bunga matahari|Alizeti|向日葵|सूरजमुखी|সূর্যমুখী" },
  { id: "sesame", icon: "sprig", m: "تل|کنجد|Vừng|งา|Кунжут|Sesam", name: "Sesame", eco: 1937, family: "oilseed", residue: "medium", ar: "سمسم", aliases: ["sesame", "simsim"],
    n: "Sésamo|Sésame|Gergelim|Кунжут|Susam|Wijen|Ufuta|芝麻|तिल|তিল" },
  { id: "safflower", icon: "sunflower", m: "کسمبہ|گلرنگ|Hồng hoa|คำฝอย|Сафлор|Färberdistel", name: "Safflower", eco: 2514, family: "daisy", residue: "medium", ar: "قرطم", aliases: ["safflower", "عصفر"],
    n: "Cártamo|Carthame|Cártamo|Сафлор|Aspir|Kasumba|Kasumba|红花|कुसुम|কুসুম ফুল" },
  { id: "linseed", icon: "sprig", m: "السی|کتان|Lanh|แฟลกซ์|Льон|Lein", name: "Linseed (flax)", eco: 7336, family: "oilseed", residue: "medium", ar: "كتان", aliases: ["linseed", "flax", "flaxseed"],
    n: "Lino|Lin|Linhaça|Лён|Keten|Biji rami|Kitani|亚麻|अलसी|তিসি" },

  // ---- roots and tubers
  { id: "potato", icon: "potato", m: "آلو|سیب‌زمینی|Khoai tây|มันฝรั่ง|Картопля|Kartoffel", name: "Potato", eco: 1971, family: "solanum", residue: "low", ar: "بطاطس", aliases: ["potato", "potatoes", "بطاطا"], econ: { yieldTHa: 30, priceUsdPerT: 180, costUsdHa: 3200 },
    n: "Papa|Pomme de terre|Batata|Картофель|Patates|Kentang|Viazi mviringo|马铃薯|आलू|আলু" },
  { id: "sweetPotato", icon: "tuber", m: "شکر قندی|سیب‌زمینی شیرین|Khoai lang|มันเทศ|Батат|Süßkartoffel", name: "Sweet potato", eco: 1265, family: "root", residue: "low", ar: "بطاطا حلوة", aliases: ["sweet potato", "sweet potatoes", "بطاطا حلوه"],
    n: "Batata|Patate douce|Batata-doce|Батат|Tatlı patates|Ubi jalar|Viazi vitamu|甘薯|शकरकंद|মিষ্টি আলু" },
  { id: "cassava", icon: "tuber", m: "کساوا|کاساوا|Sắn|มันสำปะหลัง|Маніок|Maniok", name: "Cassava", eco: 1420, family: "root", residue: "medium", ar: "كسافا", aliases: ["cassava", "manioc", "yuca", "منيهوت"],
    n: "Yuca|Manioc|Mandioca|Маниок|Manyok|Singkong|Muhogo|木薯|कसावा|কাসাভা" },
  { id: "sugarBeet", icon: "beet", m: "چقندر شکر|چغندرقند|Củ cải đường|ชูการ์บีท|Цукровий буряк|Zuckerrübe", name: "Sugar beet", eco: 48742, family: "amaranth", residue: "low", ar: "بنجر السكر", aliases: ["sugar beet", "sugarbeet", "beet", "شمندر سكري", "بنجر"],
    n: "Remolacha azucarera|Betterave sucrière|Beterraba-sacarina|Сахарная свёкла|Şeker pancarı|Bit gula|Kiazisukari|甜菜|शुगर बीट|সুগার বিট" },
  { id: "carrot", icon: "carrot", m: "گاجر|هویج|Cà rốt|แครอท|Морква|Karotte", name: "Carrot", eco: 871, family: "umbel", residue: "low", ar: "جزر", aliases: ["carrot", "carrots"],
    n: "Zanahoria|Carotte|Cenoura|Морковь|Havuç|Wortel|Karoti|胡萝卜|गाजर|গাজর" },

  // ---- vegetables
  { id: "spinach", icon: "leaf", m: "پالک|اسفناج|Rau bina|ผักโขม|Шпинат|Spinat", name: "Spinach", eco: 1997, family: "amaranth", residue: "low", ar: "سبانخ", aliases: ["spinach"],
    n: "Espinaca|Épinard|Espinafre|Шпинат|Ispanak|Bayam|Spinachi|菠菜|पालक|পালং শাক" },
  { id: "tomato", icon: "tomato", m: "ٹماٹر|گوجه‌فرنگی|Cà chua|มะเขือเทศ|Помідор|Tomate", name: "Tomato", eco: 1379, family: "solanum", residue: "low", ar: "طماطم", aliases: ["tomato", "tomatoes", "بندورة"],
    n: "Tomate|Tomate|Tomate|Томат|Domates|Tomat|Nyanya|番茄|टमाटर|টমেটো" },
  { id: "eggplant", icon: "eggplant", m: "بینگن|بادمجان|Cà tím|มะเขือยาว|Баклажан|Aubergine", name: "Eggplant", eco: 1965, family: "solanum", residue: "low", ar: "باذنجان", aliases: ["eggplant", "aubergine", "brinjal"],
    n: "Berenjena|Aubergine|Berinjela|Баклажан|Patlıcan|Terong|Biringanya|茄子|बैंगन|বেগুন" },
  { id: "pepper", icon: "pepper", m: "شملہ مرچ|فلفل دلمه‌ای|Ớt chuông|พริกหวาน|Солодкий перець|Paprika", name: "Sweet pepper", eco: 618, family: "solanum", residue: "low", ar: "فلفل", aliases: ["pepper", "peppers", "capsicum", "sweet pepper", "bell pepper"],
    n: "Pimiento|Poivron|Pimentão|Перец|Biber|Cabai|Pilipili hoho|辣椒|मिर्च|মরিচ" },
  { id: "cucumber", icon: "cucumber", m: "کھیرا|خیار|Dưa chuột|แตงกวา|Огірок|Gurke", name: "Cucumber", eco: 817, family: "cucurbit", residue: "low", ar: "خيار", aliases: ["cucumber", "cucumbers"],
    n: "Pepino|Concombre|Pepino|Огурец|Salatalık|Mentimun|Tango|黄瓜|खीरा|শসা" },
  { id: "melon", icon: "melon", m: "خربوزہ|خربزه|Dưa lưới|เมลอน|Диня|Melone", name: "Melon", eco: 815, family: "cucurbit", residue: "low", ar: "شمام", aliases: ["melon", "melons", "cantaloupe", "muskmelon"],
    n: "Melón|Melon|Melão|Дыня|Kavun|Melon|Tikiti tamu|甜瓜|खरबूजा|খরমুজ" },
  { id: "pumpkin", icon: "melon", m: "کدو|کدو حلوایی|Bí đỏ|ฟักทอง|Гарбуз мускатний|Moschuskürbis", name: "Pumpkin (butternut)", eco: 820, family: "cucurbit", residue: "low", ar: "قرع عسلي", aliases: ["pumpkin", "butternut", "squash", "winter squash", "قرع"],
    n: "Calabaza|Courge musquée|Abóbora|Тыква мускатная|Bal kabağı|Labu|Boga|南瓜|कद्दू|মিষ্টি কুমড়া" },
  { id: "zucchini", icon: "cucumber", m: "زکینی|کدو سبز|Bí ngồi|ซูกินี|Кабачок|Zucchini", name: "Zucchini (summer squash)", eco: 821, family: "cucurbit", residue: "low", ar: "كوسة", aliases: ["zucchini", "courgette", "summer squash", "marrow", "كوسا"],
    n: "Calabacín|Courgette|Abobrinha|Кабачок|Sakız kabağı|Zukini|Zukini|西葫芦|ज़ुकीनी|জুকিনি" },
  { id: "cabbage", icon: "cabbage", m: "بند گوبھی|کلم|Bắp cải|กะหล่ำปลี|Капуста|Kohl", name: "Cabbage", eco: 554, family: "brassica", residue: "low", ar: "كرنب", aliases: ["cabbage", "ملفوف"],
    n: "Repollo|Chou|Repolho|Капуста|Lahana|Kubis|Kabichi|卷心菜|पत्ता गोभी|বাঁধাকপি" },
  { id: "cauliflower", icon: "cabbage", m: "پھول گوبھی|گل‌کلم|Súp lơ|กะหล่ำดอก|Цвітна капуста|Blumenkohl", name: "Cauliflower", eco: 553, family: "brassica", residue: "low", ar: "قرنبيط", aliases: ["cauliflower"],
    n: "Coliflor|Chou-fleur|Couve-flor|Цветная капуста|Karnabahar|Kembang kol|Koliflawa|花椰菜|फूलगोभी|ফুলকপি" },
  { id: "mustard", icon: "flower4", m: "سرسوں|خردل|Cải mù tạt|มัสตาร์ด|Гірчиця сарептська|Brauner Senf", name: "Mustard", eco: 548, family: "brassica", residue: "medium", ar: "خردل", aliases: ["mustard", "indian mustard", "brown mustard"],
    n: "Mostaza|Moutarde brune|Mostarda|Горчица сарептская|Hardal|Sawi|Haradali|芥菜|राई (भूरी सरसों)|সরিষা" },
  { id: "onion", icon: "onion", m: "پیاز|پیاز|Hành tây|หอมใหญ่|Цибуля|Zwiebel", name: "Onion", eco: 364, family: "allium", residue: "low", ar: "بصل", aliases: ["onion", "onions"],
    n: "Cebolla|Oignon|Cebola|Лук репчатый|Soğan|Bawang bombay|Kitunguu|洋葱|प्याज़|পেঁয়াজ" },
  { id: "garlic", icon: "onion", m: "لہسن|سیر|Tỏi|กระเทียม|Часник|Knoblauch", name: "Garlic", eco: 367, family: "allium", residue: "low", ar: "ثوم", aliases: ["garlic"],
    n: "Ajo|Ail|Alho|Чеснок|Sarımsak|Bawang putih|Kitunguu saumu|大蒜|लहसुन|রসুন" },
  { id: "okra", icon: "okra", m: "بھنڈی|بامیه|Đậu bắp|กระเจี๊ยบเขียว|Бамія|Okra", name: "Okra", eco: 289, family: "mallow", residue: "medium", ar: "بامية", aliases: ["okra", "bhindi", "gumbo"],
    n: "Quimbombó|Gombo|Quiabo|Бамия|Bamya|Okra|Bamia|秋葵|भिंडी|ঢেঁড়স" },

  // ---- fibre and forage
  { id: "cotton", icon: "cotton", m: "کپاس|پنبه|Bông|ฝ้าย|Бавовник|Baumwolle", name: "Cotton", eco: 1160, family: "mallow", residue: "high", ar: "قطن", aliases: ["cotton"],
    n: "Algodón|Coton|Algodão|Хлопчатник|Pamuk|Kapas|Pamba|棉花|कपास|তুলা" },
  { id: "alfalfa", icon: "clover", m: "لوسرن|یونجه|Cỏ linh lăng|อัลฟัลฟา|Люцерна|Luzerne", name: "Alfalfa (forage)", eco: 1428, family: "forage", nFixing: true, residue: "high", ar: "برسيم حجازي", aliases: ["alfalfa", "lucerne", "فصة", "قضب"], econ: { yieldTHa: 9, priceUsdPerT: 190, costUsdHa: 800 },
    n: "Alfalfa|Luzerne|Alfafa|Люцерна|Yonca|Alfalfa|Alfalfa|苜蓿|रिज़का|আলফালফা" },
  { id: "berseem", icon: "clover", m: "برسیم|شبدر مصری|Cỏ ba lá Ai Cập|เบอร์ซีม|Конюшина олександрійська|Alexandrinerklee", name: "Berseem clover (forage)", eco: 10522, family: "forage", nFixing: true, residue: "medium", ar: "برسيم مصري", aliases: ["berseem", "egyptian clover", "berseem clover", "برسيم"],
    n: "Trébol de Alejandría|Trèfle d'Alexandrie|Trevo-de-alexandria|Клевер александрийский|İskenderiye üçgülü|Semanggi Mesir|Klova ya Misri|埃及三叶草|बरसीम|বারসিম" },
  // ---- added 15 Nov 2026, from the same EcoCrop database
  { id: "foxtailMillet", icon: "millet", name: "Foxtail millet", eco: 9732, family: "cereal", residue: "medium", ar: "دخن ذيل الثعلب", aliases: ["foxtail millet", "italian millet"],
    n: "Mijo de cola de zorra|Millet des oiseaux|Painço-de-itália|Чумиза|Tilkikuyruğu darısı|Jewawut|Uwele wa Italia|谷子|कंगनी|কাউন", m: "کنگنی|ارزن دم‌روباهی|Kê đuôi chồn|ข้าวฟ่างหางจิ้งจอก|Чумиза|Kolbenhirse" },
  { id: "buckwheat", icon: "sprig", name: "Buckwheat", eco: 2285, family: "other", residue: "low", ar: "حنطة سوداء", aliases: ["buckwheat"],
    n: "Alforfón|Sarrasin|Trigo-sarraceno|Гречиха|Karabuğday|Soba|Bakwiti|荞麦|कुट्टू|ঢেমশি", m: "کٹو|گندم سیاه|Kiều mạch|บักวีต|Гречка|Buchweizen" },
  { id: "grainAmaranth", icon: "millet", name: "Grain amaranth", eco: 390, family: "amaranth", residue: "medium", ar: "قطيفة الحبوب", aliases: ["grain amaranth", "amaranth"],
    n: "Amaranto|Amarante|Amaranto|Амарант|Amarant|Bayam biji|Mchicha wa nafaka|籽粒苋|राजगिरा|রাজগিরা", m: "رام دانہ|تاج‌خروس دانه‌ای|Dền hạt|ผักโขมเมล็ด|Амарант|Körneramarant" },
  { id: "grassPea", icon: "pod", name: "Grass pea", eco: 7164, family: "legume", nFixing: true, residue: "low", ar: "جلبان", aliases: ["grass pea", "khesari", "chickling pea"],
    n: "Almorta|Gesse|Chícharo|Чина посевная|Mürdümük|Kacang rumput|Njegere ya Lathyrus|山黧豆|खेसारी|খেসারি", m: "کھیساری|خلر|Đậu cỏ|ถั่วหญ้า|Чина посівна|Saat-Platterbse" },
  { id: "vetch", icon: "clover", name: "Common vetch (forage)", eco: 238003, family: "forage", nFixing: true, residue: "medium", ar: "بيقية", aliases: ["vetch", "common vetch"],
    n: "Veza|Vesce commune|Ervilhaca|Вика посевная|Fiğ|Vetch|Vechi|箭筈豌豆|वीच|ভেচ", m: "ویچ|ماشک|Đậu vetch|ถั่ววีตช์|Вика посівна|Saatwicke" },
  { id: "fenugreek", icon: "sprig", name: "Fenugreek", eco: 10554, family: "legume", nFixing: true, residue: "low", ar: "حلبة", aliases: ["fenugreek", "methi"],
    n: "Fenogreco|Fenugrec|Feno-grego|Пажитник|Çemen otu|Kelabat|Uwatu|胡芦巴|मेथी|মেথি", m: "میتھی|شنبلیله|Cỏ cà ri|ลูกซัด|Гуньба|Bockshornklee" },
  { id: "lablab", icon: "pod", name: "Lablab bean", eco: 1311, family: "legume", nFixing: true, residue: "medium", ar: "لبلاب", aliases: ["lablab", "lablab bean", "hyacinth bean"],
    n: "Dolichos|Dolique lablab|Lablabe|Лаблаб|Lablab fasulyesi|Kacang komak|Fiwi|扁豆|सेम|শিম", m: "سیم|لوبیای لبلاب|Đậu ván|ถั่วแปบ|Лаблаб|Helmbohne" },
  { id: "guar", icon: "pod", name: "Guar", eco: 830, family: "legume", nFixing: true, residue: "low", ar: "غوار", aliases: ["guar", "cluster bean"],
    n: "Guar|Guar|Guar|Гуар|Guar|Kacang guar|Gwari|瓜尔豆|ग्वार|গুয়ার", m: "گوار|گوار|Đậu guar|ถั่วกัวร์|Гуар|Guarbohne" },
  { id: "blackGram", icon: "pod", name: "Black gram", eco: 2149, family: "legume", nFixing: true, residue: "low", ar: "ماش أسود", aliases: ["black gram", "urad", "urd"],
    n: "Frijol urd|Haricot urd|Feijão-urd|Урд|Kara maş|Kacang hitam|Choroko mweusi|黑吉豆|उड़द|মাষকলাই", m: "ماش|ماش سیاه|Đậu đen|ถั่วดำ|Урд|Urdbohne" },
  { id: "limaBean", icon: "pod", name: "Lima bean", eco: 1666, family: "legume", nFixing: true, residue: "low", ar: "فاصوليا ليما", aliases: ["lima bean", "butter bean"],
    n: "Pallar|Haricot de Lima|Feijão-fava|Лимская фасоль|Lima fasulyesi|Kacang lima|Maharagwe ya lima|利马豆|लिमा बीन|লিমা শিম", m: "لیما بین|لوبیای لیما|Đậu ngự|ถั่วลิมา|Лімська квасоля|Limabohne" },
  { id: "niger", icon: "sunflower", name: "Niger seed", eco: 6567, family: "daisy", residue: "medium", ar: "غيزوتيا", aliases: ["niger seed", "nyjer", "ramtil"],
    n: "Níger|Nyjer|Níger|Гизоция|Nijer tohumu|Niger|Nuga|小葵子|रामतिल|সরগুজা", m: "رام تل|گیزوتیا|Cúc niger|ไนเจอร์|Гізоція|Ramtillkraut" },
  { id: "radish", icon: "beet", name: "Radish", eco: 11291, family: "brassica", residue: "low", ar: "فجل", aliases: ["radish", "radishes"],
    n: "Rábano|Radis|Rabanete|Редис|Turp|Lobak|Figili|萝卜|मूली|মুলা", m: "مولی|تربچه|Củ cải|แรดิช|Редиска|Radieschen" },
  { id: "turnip", icon: "beet", name: "Turnip", eco: 3881, family: "brassica", residue: "low", ar: "لفت", aliases: ["turnip", "turnips"],
    n: "Nabo|Navet|Nabo|Репа|Şalgam|Turnip|Tanipu|芜菁|शलजम|শালগম", m: "شلجم|شلغم|Củ cải tròn|เทอร์นิป|Ріпа|Speiserübe" },
  { id: "pakChoi", icon: "leaf", name: "Pak choi", eco: 3878, family: "brassica", residue: "low", ar: "باك تشوي", aliases: ["pak choi", "bok choy", "pak choy"],
    n: "Pak choi|Pak-choï|Pak choi|Пак-чой|Pak choi|Pakcoy|Pak choi|小白菜|पाक चोई|পাক চয়", m: "پاک چوئی|کلم چینی|Cải thìa|ผักกาดฮ่องเต้|Пак-чой|Pak Choi" },
  { id: "chard", icon: "leaf", name: "Swiss chard", eco: 2474, family: "amaranth", residue: "low", ar: "سلق", aliases: ["swiss chard", "chard", "silverbeet"],
    n: "Acelga|Blette|Acelga|Мангольд|Pazı|Chard|Chadi|莙荙菜|स्विस चार्ड|সুইস চার্ড", m: "سوئس چارڈ|چغندر برگی|Cải cầu vồng|สวิสชาร์ด|Мангольд|Mangold" },
  { id: "lettuce", icon: "leaf", name: "Lettuce", eco: 1313, family: "daisy", residue: "low", ar: "خس", aliases: ["lettuce"],
    n: "Lechuga|Laitue|Alface|Салат-латук|Marul|Selada|Saladi|生菜|सलाद पत्ता|লেটুস", m: "سلاد پتہ|کاهو|Xà lách|ผักกาดหอม|Салат|Kopfsalat" },
  { id: "broccoli", icon: "broccoli", name: "Broccoli", eco: 556, family: "brassica", residue: "low", ar: "بروكلي", aliases: ["broccoli"],
    n: "Brócoli|Brocoli|Brócolis|Брокколи|Brokoli|Brokoli|Brokoli|西兰花|ब्रोकली|ব্রকলি", m: "بروکلی|کلم بروکلی|Bông cải xanh|บรอกโคลี|Броколі|Brokkoli" },
  { id: "kale", icon: "leaf", name: "Kale", eco: 3867, family: "brassica", residue: "low", ar: "كرنب أجعد", aliases: ["kale", "collards", "sukuma wiki"],
    n: "Kale|Chou frisé|Couve|Кале|Kara lahana|Kale|Sukuma wiki|羽衣甘蓝|केल|কেল", m: "کیل|کلم پیچ برگ|Cải xoăn|คะน้าใบหยิก|Кейл|Grünkohl" },
  { id: "leek", icon: "onion", name: "Leek", eco: 363, family: "allium", residue: "low", ar: "كراث", aliases: ["leek", "leeks"],
    n: "Puerro|Poireau|Alho-poró|Лук-порей|Pırasa|Bawang perai|Liki|韭葱|लीक|লিক", m: "لیک|تره‌فرنگی|Tỏi tây|กระเทียมต้น|Цибуля-порей|Lauch" },
  { id: "shallot", icon: "onion", name: "Shallot", eco: 1096, family: "allium", residue: "low", ar: "بصل شالوت", aliases: ["shallot", "shallots", "multiplier onion"],
    n: "Chalota|Échalote|Chalota|Лук-шалот|Arpacık soğan|Bawang merah|Kitunguu kidogo|红葱头|छोटा प्याज़|ছোট পেঁয়াজ", m: "چھوٹا پیاز|پیاز شالوت|Hành tím|หอมแดง|Цибуля-шалот|Schalotte" },
  { id: "chilli", icon: "pepper", name: "Chilli pepper", eco: 621, family: "solanum", residue: "low", ar: "فلفل حار", aliases: ["chilli", "chilli pepper", "hot pepper", "cayenne"],
    n: "Chile|Piment|Pimenta-malagueta|Перец чили|Acı biber|Cabai rawit|Pilipili|朝天椒|तीखी मिर्च|কাঁচা মরিচ", m: "ہری مرچ|فلفل تند|Ớt hiểm|พริกขี้หนู|Перець чилі|Chili" },
  { id: "celery", icon: "sprig", name: "Celery", eco: 432, family: "umbel", residue: "low", ar: "كرفس", aliases: ["celery"],
    n: "Apio|Céleri|Aipo|Сельдерей|Kereviz|Seledri|Seleri|芹菜|सेलरी|সেলারি", m: "سیلری|کرفس|Cần tây|ขึ้นฉ่ายฝรั่ง|Селера|Stangensellerie" },
  { id: "bitterGourd", icon: "cucumber", name: "Bitter gourd", eco: 7795, family: "cucurbit", residue: "low", ar: "قرع مر", aliases: ["bitter gourd", "bitter melon", "karela"],
    n: "Melón amargo|Margose|Melão-de-são-caetano|Момордика|Kudret narı|Pare|Karela|苦瓜|करेला|করলা", m: "کریلا|کدو تلخ|Mướp đắng|มะระ|Момордика|Bittermelone" },
  { id: "bottleGourd", icon: "cucumber", name: "Bottle gourd", eco: 1315, family: "cucurbit", residue: "low", ar: "يقطين", aliases: ["bottle gourd", "calabash", "lauki"],
    n: "Calabaza vinatera|Calebasse|Cabaça|Лагенария|Su kabağı|Labu air|Mumunye|葫芦|लौकी|লাউ", m: "لوکی|کدو قلیانی|Bầu|น้ำเต้า|Лагенарія|Flaschenkürbis" },
  { id: "coriander", icon: "sprig", name: "Coriander", eco: 784, family: "umbel", residue: "low", ar: "كزبرة", aliases: ["coriander", "cilantro", "dhania"],
    n: "Cilantro|Coriandre|Coentro|Кориандр|Kişniş|Ketumbar|Giligilani|芫荽|धनिया|ধনে", m: "دھنیا|گشنیز|Rau mùi|ผักชี|Коріандр|Koriander" },
  { id: "cumin", icon: "sprig", name: "Cumin", eco: 5043, family: "umbel", residue: "low", ar: "كمون", aliases: ["cumin", "jeera"],
    n: "Comino|Cumin|Cominho|Зира|Kimyon|Jintan putih|Jira|孜然|जीरा|জিরা", m: "زیرہ|زیره|Thì là Ai Cập|ยี่หร่า|Кмин римський|Kreuzkümmel" },
  { id: "kenaf", icon: "sprig", name: "Kenaf", eco: 1213, family: "mallow", residue: "high", ar: "كناف", aliases: ["kenaf"],
    n: "Kenaf|Kénaf|Kenaf|Кенаф|Kenaf|Kenaf|Kenafu|红麻|मेस्ता|মেস্তা", m: "کیناف|کنف|Đay cách|ปอแก้ว|Кенаф|Kenaf" },
  { id: "ryegrass", icon: "grass", name: "Italian ryegrass (forage)", eco: 7389, family: "forage", residue: "high", ar: "ريغراس إيطالي", aliases: ["ryegrass", "italian ryegrass"],
    n: "Raigrás italiano|Ray-grass d'Italie|Azevém|Райграс однолетний|İtalyan çimi|Rumput ryegrass|Nyasi ya raigrasi|多花黑麦草|राईग्रास|রাইগ্রাস", m: "رائی گراس|چچم ایتالیایی|Cỏ lúa mạch đen|หญ้าไรย์|Райграс|Welsches Weidelgras" },
  { id: "tobacco", icon: "leaf", name: "Tobacco", eco: 1534, family: "solanum", residue: "low", ar: "تبغ", aliases: ["tobacco"],
    n: "Tabaco|Tabac|Tabaco|Табак|Tütün|Tembakau|Tumbaku|烟草|तंबाकू|তামাক", m: "تمباکو|تنباکو|Thuốc lá|ยาสูบ|Тютюн|Tabak" },
];

function build(d: Def): Crop {
  const e = ECO.get(d.eco);
  if (!e) throw new Error(`crops.ts: EcoPort ${d.eco} (${d.id}) is not in ecocrop.json`);
  const names = Object.fromEntries([
    ...d.n.split("|").map((v, i) => [NAME_LOCALES[i], v.trim()]),
    ...d.m.split("|").map((v, i) => [MORE_LOCALES[i], v.trim()]),
  ]);
  names.ar = d.ar;
  const cycle = `${e.gMin}–${e.gMax}`;
  return {
    id: d.id, name: d.name, icon: d.icon, scientific: e.scientific, ecoPort: e.code, family: d.family, nFixing: !!d.nFixing, residue: d.residue,
    soil: { best: e.textOpt as SoilTexture[], tolerated: e.textAbs as SoilTexture[] },
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
