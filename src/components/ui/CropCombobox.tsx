"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, cropName } from "@/data/crops";
import { Icon } from "./Icon";
import { useDismiss, useTouchFirst } from "./hooks";

/**
 * Crop picker. With a mouse it is a searchable list with a family tag on every row.
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

  const items = useMemo(() => CROPS.map((c) => ({ id: c.id, name: cropName(c.id, locale), family: fam(c.family), hay: `${cropName(c.id, locale)} ${c.name} ${fam(c.family)} ${(c.aliases ?? []).join(" ")}`.toLowerCase() })), [locale, fam]);
  const hits = useMemo(() => { const s = q.trim().toLowerCase(); return s ? items.filter((i) => i.hay.includes(s)) : items; }, [items, q]);
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
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) choose(hits[active].id); }
  };

  return (
    // No `relative` here on purpose: the list anchors to the row of three pickers, so it can be wider than one of them.
    <div ref={box} className="min-w-0 flex-1">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current?.name ?? value}`}
        onClick={() => { setOpen((o) => !o); setActive(Math.max(0, hits.findIndex((h) => h.id === value))); }}
        className="fs-field flex w-full items-center justify-between gap-1 text-start text-sm">
        <span className="truncate">{current?.name ?? value}</span>
        <Icon name="chevron" size={16} className="text-muted" />
      </button>
      {open && (
        <div className="fs-pop absolute inset-x-0 top-full z-30 mt-1 p-2">
          <label className="relative block">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={key}
              role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={hits[active] ? `${id}-${hits[active].id}` : undefined}
              aria-label={t("searchCrop")} placeholder={t("searchCrop")} className="fs-field w-full ps-9 text-sm" />
          </label>
          <ul id={id} role="listbox" aria-label={label} className="mt-1 max-h-64 overflow-y-auto overscroll-contain">
            {hits.map((h, i) => (
              <li key={h.id} id={`${id}-${h.id}`} role="option" aria-selected={h.id === value}>
                <button type="button" tabIndex={-1} data-active={i === active} data-selected={h.id === value} onMouseEnter={() => setActive(i)} onClick={() => choose(h.id)} className="fs-option justify-between">
                  <span className="flex items-center gap-2">{h.name}{h.id === value && <Icon name="check" size={16} className="text-gold-text" />}</span>
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
