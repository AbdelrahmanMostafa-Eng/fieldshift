// Only languages that have a translated file in messages/. The plan is to add pt, id, sw, ru, tr and bn next.
export const LOCALES = ["en", "ar", "es", "fr", "hi", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const NATIVE_NAMES: Record<Locale, string> = {
  en: "English", ar: "العربية", es: "Español", fr: "Français", hi: "हिन्दी", zh: "中文",
};

const RTL = new Set(["ar", "he", "fa", "ur"]);
export const dirFor = (l: string): "rtl" | "ltr" => (RTL.has(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
