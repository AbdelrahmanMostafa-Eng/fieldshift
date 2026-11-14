"use client";

/**
 * A slider with a filled track and a small value bubble that appears on hover, touch and keyboard focus.
 * `bubble` is the text shown in the bubble and announced to screen readers.
 */
export function Range({ value, min, max, step = 1, onChange, bubble, label, id }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; bubble: string; label?: string; id?: string;
}) {
  const p = max === min ? 0 : (value - min) / (max - min);
  return (
    <span className="fs-range-wrap" style={{ ["--p" as string]: p }}>
      <input id={id} type="range" className="fs-range" min={min} max={max} step={step} value={value}
        aria-label={label} aria-valuetext={bubble} onChange={(e) => onChange(Number(e.target.value))} />
      <output className="fs-range-bubble" aria-hidden="true">{bubble}</output>
    </span>
  );
}
