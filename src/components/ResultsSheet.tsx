"use client";
import { useEffect, useRef, useState } from "react";

const PEEK_PX = 116;          // handle + the summary lines: place, "N strategies", top match
const HALF = 0.5, FULL = 0.92; // visible share of the viewport height
const WIDE = 1024;             // from here up the sheet is a side panel and does not move

/**
 * Bottom sheet on phones and tablets, side panel on laptops.
 * Three resting heights: peek (just the summary), half, full. Drag the header, tap it, or use the arrow keys.
 * `summary` is always visible, so the peek height still says where you are and what was found.
 * `onVisibleChange` reports the height (px) the sheet covers at rest, so the globe can frame itself above it.
 */
export function ResultsSheet({ title, summary, children, onVisibleChange }: { title: string; summary: React.ReactNode; children: React.ReactNode; onVisibleChange?: (px: number) => void }) {
  const [snap, setSnap] = useState(1);
  const [size, setSize] = useState({ w: 1280, h: 800 });
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef({ y: 0, visible: 0, t: 0 });
  const dragged = useRef(false);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const wide = size.w >= WIDE;
  const snaps = [PEEK_PX, size.h * HALF, size.h * FULL];
  const rest = snaps[snap];
  useEffect(() => { onVisibleChange?.(Math.round(rest)); }, [rest, onVisibleChange]);

  const full = snaps[2];
  const visible = drag ?? rest;
  const offset = Math.max(0, full - visible);

  const down = (e: React.PointerEvent) => {
    if (wide) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, visible: rest, t: performance.now() };
    dragged.current = false;
    setDrag(rest);
  };
  const move = (e: React.PointerEvent) => {
    if (drag === null) return;
    if (Math.abs(start.current.y - e.clientY) > 4) dragged.current = true;
    setDrag(Math.min(full, Math.max(PEEK_PX * 0.7, start.current.visible + (start.current.y - e.clientY))));
  };
  const up = (e: React.PointerEvent) => {
    if (drag === null) return;
    const v = (start.current.y - e.clientY) / Math.max(1, performance.now() - start.current.t); // px/ms, + = up
    const projected = drag + v * 180; // a flick carries the sheet towards the next stop
    let best = 0;
    snaps.forEach((s, i) => { if (Math.abs(s - projected) < Math.abs(snaps[best] - projected)) best = i; });
    if (dragged.current) setSnap(best);
    setDrag(null);
  };
  // A tap (or Enter/Space on the handle) steps to the next height. A drag is not a tap.
  const tap = () => { if (!wide && !dragged.current) setSnap((s) => (s + 1) % snaps.length); dragged.current = false; };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setSnap((s) => Math.min(snaps.length - 1, s + 1)); }
    if (e.key === "ArrowDown") { e.preventDefault(); setSnap((s) => Math.max(0, s - 1)); }
  };

  return (
    <section
      aria-label={title}
      style={{ ["--sheet-y" as string]: `${offset}px`, height: `${full}px` }}
      className={`fs-grain fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl border border-line bg-surface shadow-lift [transform:translateY(var(--sheet-y))] ${drag === null ? "transition-transform duration-300 ease-fs" : ""} lg:inset-y-0 lg:start-0 lg:end-auto lg:!h-dvh lg:w-[440px] lg:rounded-none lg:rounded-e-xl lg:[transform:none]`}
    >
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={tap}
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing lg:cursor-auto lg:touch-auto lg:select-text">
        <button type="button" onKeyDown={key} aria-expanded={snap > 0} aria-label={title} className="flex h-6 w-full items-center justify-center lg:hidden">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <div className="px-5 pb-3 lg:pt-5">{summary}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
    </section>
  );
}
