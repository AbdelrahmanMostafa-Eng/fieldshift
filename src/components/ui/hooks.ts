"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Closes a floating panel on a press outside it or on Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [ref, open, close]);
}

/** Follows a CSS media query. False on the server and on the first client render. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True on phones and tablets, where native pickers work better than custom lists. */
export const useTouchFirst = () => useMedia("(pointer: coarse)");

/**
 * Counts from the previous value to the new one over `ms` (default: the long motion token, 420 ms).
 * Jumps straight to the value when the user asks for reduced motion.
 */
export function useCountUp(target: number, ms = 420): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (target - start) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** False while the browser reports no network. True on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
    },
    () => navigator.onLine,
    () => true,
  );
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Sliding thumb for a segmented control or tab strip (.fs-seg in globals.css).
 * Measures the chosen option and writes its place to --thumb-x / --thumb-w on the container; the CSS draws and animates the thumb.
 * Until the first measurement the chosen option keeps its own fill, so nothing flashes without JavaScript.
 * `value` is only there to re-measure when the choice changes.
 */
export function useThumb(ref: RefObject<HTMLElement | null>, value: string) {
  useIsoLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let live = 0;
    const place = () => {
      const on = box.querySelector<HTMLElement>(':scope > [aria-checked="true"], :scope > [aria-selected="true"]');
      if (!on) { delete box.dataset.thumb; return; }
      box.style.setProperty("--thumb-x", `${on.offsetLeft}px`);
      box.style.setProperty("--thumb-w", `${on.offsetWidth}px`);
      if (!box.dataset.thumb) {
        box.dataset.thumb = "set"; // placed without a transition the first time
        live = requestAnimationFrame(() => { live = requestAnimationFrame(() => { box.dataset.thumb = "live"; }); });
      }
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(box);
    for (const child of box.children) ro.observe(child);
    return () => { ro.disconnect(); cancelAnimationFrame(live); };
  }, [ref, value]);
}
