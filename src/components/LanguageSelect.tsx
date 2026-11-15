"use client";
import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { LOCALES, NATIVE_NAMES, type Locale } from "@/i18n/config";
import { Icon } from "./ui/Icon";
import { useDismiss, revealActive, stepActive } from "./ui/hooks";

/**
 * Language picker: every language in its own name, with a search box.
 * `tone="dark"` is for the intro, which sits on the night sky in both themes.
 * `anchor="bar"` lets the list hang from the header instead of the button (phones, where the button is mid-row).
 */
export function LanguageSelect({ compact = false, tone = "surface", anchor = "self" }: { compact?: boolean; tone?: "surface" | "dark"; anchor?: "self" | "bar" }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => { setOpen(false); setQ(""); }, []);
  useDismiss(box, open, close);
  const list = useRef<HTMLUListElement>(null);

  // Each language also carries its name in the current page language, so "Arabic" finds العربية.
  const items = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([locale], { type: "language" }); } catch { /* older browsers: native names only */ }
    return LOCALES.map((l) => ({ code: l, native: NATIVE_NAMES[l], local: names?.of(l) ?? "" }));
  }, [locale]);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => `${i.native} ${i.local} ${i.code}`.toLowerCase().includes(s)) : items;
  }, [items, q]);

  const choose = (code: Locale) => { close(); if (code !== locale) start(async () => { await setLocale(code); router.refresh(); }); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => stepActive(a, 1, hits.length)); revealActive(list); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => stepActive(a, -1, hits.length)); revealActive(list); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) choose(hits[active].code); }
  };

  return (
    <div ref={box} className={anchor === "self" ? "relative" : ""}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-busy={pending} aria-label={`${t("language")}: ${NATIVE_NAMES[locale]}`} title={t("language")}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, items.findIndex((i) => i.code === locale))); revealActive(list); }}
        className={tone === "dark" ? "fs-btn fs-btn-ghost px-3" : "fs-btn fs-btn-quiet px-3"}>
        <Icon name={pending ? "spinner" : "language"} />
        <span className={compact ? "font-mono text-xs uppercase" : ""}>{compact ? locale : NATIVE_NAMES[locale]}</span>
      </button>
      {open && (
        <div className={`fs-pop absolute top-full z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] p-2 text-start ${anchor === "self" ? "end-0" : "end-3"}`}>
          <label className="relative block">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); revealActive(list); }} onKeyDown={key}
              role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={hits[active] ? `${id}-${hits[active].code}` : undefined}
              aria-label={t("searchLanguage")} placeholder={t("searchLanguage")} className="fs-field w-full ps-9 text-sm" />
          </label>
          <ul ref={list} id={id} role="listbox" aria-label={t("language")} className="mt-1 max-h-[min(22rem,55dvh)] overflow-y-auto overscroll-contain">
            {hits.map((h, i) => (
              <li key={h.code} id={`${id}-${h.code}`} role="option" aria-selected={h.code === locale}>
                <button type="button" tabIndex={-1} lang={h.code} data-active={i === active} data-selected={h.code === locale} onMouseEnter={() => setActive(i)} onClick={() => choose(h.code)} className="fs-option justify-between">
                  <span className="flex items-center gap-2">{h.native}{h.code === locale && <Icon name="check" size={16} className="text-gold-text" />}</span>
                  {h.local && h.local.toLowerCase() !== h.native.toLowerCase() && <span className="text-xs text-muted" lang={locale}>{h.local}</span>}
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("noLanguage")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
