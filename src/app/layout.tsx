import type { Metadata, Viewport } from "next";
import {
  Fraunces, Hanken_Grotesk, JetBrains_Mono, Literata,
  Noto_Naskh_Arabic, Noto_Sans, Noto_Sans_Arabic, Noto_Sans_Bengali, Noto_Sans_Devanagari,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { dirFor } from "@/i18n/config";
import "./globals.css";

// Latin faces. Fraunces keeps its optical-size axis, so large headings get the display cut automatically.
const serif = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"] });
const grotesk = Hanken_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });

// Other scripts. Not preloaded: the browser fetches a file only when the page shows that script.
// Chinese uses the fonts already on the device (see the stacks in globals.css), since a web font for it is very large.
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], preload: false });
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], preload: false });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], preload: false });
const bengali = Noto_Sans_Bengali({ variable: "--font-bengali", subsets: ["bengali"], preload: false });
// Russian: Hanken Grotesk and Fraunces have no basic Cyrillic, so these step in for those letters only.
const cyrSans = Noto_Sans({ variable: "--font-cyr-sans", subsets: ["cyrillic"], preload: false });
const cyrSerif = Literata({ variable: "--font-cyr-serif", subsets: ["cyrillic"], preload: false });

export const metadata: Metadata = {
  title: "FieldShift",
  description: "Explore crop rotations with NASA Earth observations.",
};
export const viewport: Viewport = { themeColor: "#0e0d0b", viewportFit: "cover" };

// Runs before first paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const fonts = [serif, grotesk, mono, arabic, naskh, devanagari, bengali, cyrSans, cyrSerif].map((f) => f.variable).join(" ");
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning className={fonts}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="h-dvh overflow-hidden antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
