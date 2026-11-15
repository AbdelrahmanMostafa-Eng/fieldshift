// Only languages that have a translated file in messages/. All but English and Arabic are first-pass translations.
export const LOCALES = ["en", "ar", "es", "fr", "pt", "ru", "tr", "id", "sw", "hi", "bn", "zh", "de", "uk", "vi", "th", "fa", "ur", "fi", "ms"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const NATIVE_NAMES: Record<Locale, string> = {
  en: "English", ar: "العربية", es: "Español", fr: "Français", pt: "Português", ru: "Русский", tr: "Türkçe",
  id: "Bahasa Indonesia", sw: "Kiswahili", hi: "हिन्दी", bn: "বাংলা", zh: "中文",
  de: "Deutsch", uk: "Українська", vi: "Tiếng Việt", th: "ไทย", fa: "فارسی", ur: "اردو", fi: "Suomi", ms: "Bahasa Melayu",
};

const RTL = new Set(["ar", "he", "fa", "ur"]);
export const dirFor = (l: string): "rtl" | "ltr" => (RTL.has(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
