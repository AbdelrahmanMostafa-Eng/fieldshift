"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { CropIcon } from "./CropIcon";
import { Icon } from "./Icon";
import { useDismiss, useTouchFirst, revealActive, stepActive } from "./hooks";

/**
 * Crop picker, in alphabetical order for the page language. With a mouse it is a searchable list with an icon and a family tag on every row.
 * On touch devices it stays a native select, which phones handle better than any custom list.
 */
export function CropCombobox({ value, onChange, label }: { value: string; onChange: (id: string) => void; label: string }) {
  const t = useTranslations("plan");
  const fam = useTranslations("family");
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
    return CROPS.map((c) => ({ id: c.id, icon: c.icon, name: cropName(c.id, locale), family: fam(c.family), hay: `${cropName(c.id, locale)} ${c.name} ${c.scientific} ${fam(c.family)} ${(c.aliases ?? []).join(" ")}`.toLocaleLowerCase(locale) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [locale, fam]);
  const hits = useMemo(() => { const s = q.trim().toLocaleLowerCase(locale); return s ? items.filter((i) => i.hay.includes(s)) : items; }, [items, q, locale]);
  const current = items.find((i) => i.id === value);

  if (touch) {
    return (
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="fs-field min-w-0 flex-1 text-sm">
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    );
  }

  const choose = (cropId: string) => { onChange(cropId); close(); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => stepActive(a, 1, hits.length)); revealActive(list); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => stepActive(a, -1, hits.length)); revealActive(list); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) choose(hits[active].id); }
  };

  return (
    // No `relative` here on purpose: the list anchors to the whole row of pickers, so it can be wider than one of them.
    <div ref={box} className="min-w-0 flex-1">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current?.name ?? value}`}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, hits.findIndex((h) => h.id === value))); revealActive(list); }}
        className="fs-field flex w-full items-center justify-between gap-1 text-start text-sm">
        <span className="flex min-w-0 items-center gap-1.5">{current && <CropIcon icon={current.icon} size={16} className="text-gold-text" />}<span className="truncate">{current?.name ?? value}</span></span>
        <Icon name="chevron" size={16} className="text-muted" />
      </button>
      {open && (
        <div className="fs-pop absolute inset-x-0 top-full z-30 mt-1 p-2">
          <label className="relative block">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); revealActive(list); }} onKeyDown={key}
              role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={hits[active] ? `${id}-${hits[active].id}` : undefined}
              aria-label={t("searchCrop")} placeholder={t("searchCrop")} className="fs-field w-full ps-9 text-sm" />
          </label>
          <ul ref={list} id={id} role="listbox" aria-label={label} className="mt-1 max-h-64 overflow-y-auto overscroll-contain">
            {hits.map((h, i) => (
              <li key={h.id} id={`${id}-${h.id}`} role="option" aria-selected={h.id === value}>
                <button type="button" tabIndex={-1} data-active={i === active} data-selected={h.id === value} onMouseEnter={() => setActive(i)} onClick={() => choose(h.id)} className="fs-option justify-between">
                  <span className="flex items-center gap-2"><CropIcon icon={h.icon} size={18} className="text-gold-text" />{h.name}{h.id === value && <Icon name="check" size={16} className="text-gold-text" />}</span>
                  <span className="fs-tag">{h.family}</span>
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("noCrop")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
