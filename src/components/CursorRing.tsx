"use client";
import { useEffect, useRef } from "react";
import { useMedia } from "./ui/hooks";

const INTERACTIVE = "a, button, select, summary, label, [role='radio'], [role='tab'], [role='option'], input[type='range'], input[type='checkbox']";
const TEXT = "input:not([type='range']):not([type='checkbox']), textarea, [contenteditable='true']";

/**
 * A soft ring that trails the pointer with a little easing. Mouse and trackpad only.
 * It grows over things you can press, tightens into a sight over the planet, and disappears over text boxes.
 * The native cursor is never replaced, so text inputs keep their I-beam. With reduced motion the ring does not trail.
 */
export function CursorRing() {
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ring.current;
    if (!fine || !el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, seen = false, down = false;
    const place = () => { el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
    const tick = () => {
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      place();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0; // stops when it has caught up
    };
    const mode = (target: EventTarget | null) => {
      const node = target instanceof Element ? target : null;
      if (!node) return "idle";
      if (node.closest(TEXT)) return "text";
      if (down) return "down";
      if (node.closest(INTERACTIVE)) return "hover";
      if (node.closest(".fs-globe[data-over='globe'] .maplibregl-canvas-container")) return "globe";
      return "idle";
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tx = e.clientX; ty = e.clientY;
      if (!seen || still) { x = tx; y = ty; seen = true; place(); }
      else if (!raf) raf = requestAnimationFrame(tick);
      el.dataset.on = "true";
      el.dataset.mode = mode(e.target);
    };
    const press = (e: PointerEvent) => { down = e.type === "pointerdown"; el.dataset.mode = mode(e.target); };
    const leave = () => { el.dataset.on = "false"; };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", press, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", press);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [fine]);

  if (!fine) return null;
  return <div ref={ring} className="fs-cursor" aria-hidden="true"><i /></div>;
}
