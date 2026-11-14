import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale } from "./config";

export default getRequestConfig(async () => {
  const stored = (await cookies()).get("locale")?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import("../../messages/en.json")).default; // locale file not generated yet
  }
  return { locale, messages };
});
