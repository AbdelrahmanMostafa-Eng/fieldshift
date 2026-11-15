"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "./Icon";
import { useDismiss, useTouchFirst, revealActive, stepActive } from "./hooks";

export interface CurrencyItem { code: string; name: string }

/**
 * Currency picker: every currency with an exchange rate, in alphabetical order of its name in the page language,
 * searchable by name or ISO code. Touch devices keep a native select, in the same order.
 */
export function CurrencyCombobox({ value, onChange, currencies }: { value: string; onChange: (code: string) => void; currencies: CurrencyItem[] }) {
  const t = useTranslations("money");
  const locale = useLocale();
  const touch = useTouchFirst();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => { setOpen(false); setQ(""); }, []);
  useDismiss(box, open, close);
  const list = useRef<HTMLUListElement>(null);

  const items = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return [...currencies].sort((a, b) => collator.compare(a.name, b.name) || a.code.localeCompare(b.code));
  }, [currencies, locale]);
  // Search the code, the name in the page language and the English name, so "yen" or "JPY" works in every language.
  const hay = useMemo(() => {
    let en: Intl.DisplayNames | null = null;
    try { en = new Intl.DisplayNames(["en"], { type: "currency" }); } catch { /* older browsers: code and local name only */ }
    return new Map(items.map((c) => [c.code, `${c.code} ${c.name} ${en?.of(c.code) ?? ""}`.toLocaleLowerCase(locale)]));
  }, [items, locale]);
  const hits = useMemo(() => {
    const s = q.trim().toLocaleLowerCase(locale);
    return s ? items.filter((c) => hay.get(c.code)?.includes(s)) : items;
  }, [items, hay, q, locale]);
  const current = items.find((c) => c.code === value);

  if (touch) {
    return (
      <select aria-label={t("currency")} value={value} onChange={(e) => onChange(e.target.value)} className="fs-field min-w-0 flex-1">
        {items.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}
      </select>
    );
  }

  const choose = (code: string) => { onChange(code); close(); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => stepActive(a, 1, hits.length)); revealActive(list); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => stepActive(a, -1, hits.length)); revealActive(list); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) choose(hits[active].code); }
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${t("currency")}: ${current?.name ?? value}`}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, items.findIndex((c) => c.code === value))); revealActive(list); }}
        className="fs-field flex w-full items-center justify-between gap-2 text-start">
        <span className="truncate">{current ? `${current.name} · ${current.code}` : value}</span>
        <Icon name="chevron" size={16} className="text-muted" />
      </button>
      {open && (
        <div className="fs-pop absolute inset-x-0 top-full z-30 mt-1 p-2">
          <label className="relative block">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); revealActive(list); }} onKeyDown={key}
              role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={hits[active] ? `${id}-${hits[active].code}` : undefined}
              aria-label={t("search")} placeholder={t("search")} className="fs-field w-full ps-9 text-sm" />
          </label>
          <p className="mt-1 px-1 text-[11px] text-muted">{t("count", { count: items.length })}</p>
          <ul ref={list} id={id} role="listbox" aria-label={t("currency")} className="mt-1 max-h-64 overflow-y-auto overscroll-contain">
            {hits.map((c, i) => (
              <li key={c.code} id={`${id}-${c.code}`} role="option" aria-selected={c.code === value}>
                <button type="button" tabIndex={-1} data-active={i === active} data-selected={c.code === value} onMouseEnter={() => setActive(i)} onClick={() => choose(c.code)} className="fs-option justify-between">
                  <span className="flex min-w-0 items-center gap-2"><span className="truncate">{c.name}</span>{c.code === value && <Icon name="check" size={16} className="text-gold-text" />}</span>
                  <span className="font-mono text-xs text-muted">{c.code}</span>
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("none")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
