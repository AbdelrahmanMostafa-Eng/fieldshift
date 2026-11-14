/** Lowercase, strip Latin accents, and unify Arabic letter variants so "قمح"/"القمح"/"أَقماح" match predictably. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")        // Latin diacritics
    .replace(/[ً-ٰٟـ]/g, "") // Arabic tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const isAscii = (s: string) => /^[\x00-\x7f]*$/.test(s);

/**
 * Keyword match on normalized text.
 * - ASCII keyword: matches at the start of a word ("irrigat" matches "irrigation"); a trailing "$" demands a whole word ("et$").
 * - Arabic keyword: plain substring, because Arabic attaches prefixes (ال، و، ب) to words; with "$" it must be a whole word (prefixes allowed).
 */
export function hasKeyword(textN: string, keyword: string): boolean {
  const exact = keyword.endsWith("$");
  const k = normalize(exact ? keyword.slice(0, -1) : keyword);
  if (!k) return false;
  if (!isAscii(k)) {
    // Arabic: whole word (optionally with a one-letter or "ال" prefix) when "$" is given, else plain substring.
    return exact ? new RegExp(`(^| )(وال|بال|لل|ال|و|ب|ل)?${k}( |$)`).test(textN) : textN.includes(k);
  }
  return new RegExp(`(^| )${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${exact ? "( |$)" : ""}`).test(textN);
}
