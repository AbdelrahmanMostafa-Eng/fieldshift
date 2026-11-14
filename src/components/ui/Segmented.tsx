"use client";
import { Icon, type IconName } from "./Icon";

export interface SegOption<T extends string> { value: T; label: string; icon?: IconName }

/**
 * A segmented control: a radio group drawn as one bar. Arrow keys move the choice (and follow the reading direction).
 * `iconOnly` hides the text but keeps it as the accessible name and tooltip.
 */
export function Segmented<T extends string>({ label, value, options, onChange, iconOnly = false, block = false }: {
  label: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void; iconOnly?: boolean; block?: boolean;
}) {
  const key = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const dir = (e.key === "ArrowRight" || e.key === "ArrowLeft") && rtl ? -step : step;
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.value);
    (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={key} className={`fs-seg${block ? " fs-seg-block" : ""}`}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" data-value={o.value} aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1}
          aria-label={iconOnly ? o.label : undefined} title={iconOnly ? o.label : undefined} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={18} />}
          {!(iconOnly && o.icon) && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
