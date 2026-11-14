"use client";
import { useEffect, useRef } from "react";

/** Small seeded generator, so the sky is the same on every visit and never "twinkles" on re-render. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fine, static star field drawn once per size change. Sits behind the transparent map canvas. */
export function StarField({ strength }: { strength: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const rnd = mulberry32(20261115);
      const count = Math.round((w * h) / 2400);
      for (let i = 0; i < count; i++) {
        const x = rnd() * w, y = rnd() * h, mag = rnd(), tint = rnd();
        const radius = mag > 0.985 ? 1.2 : mag > 0.9 ? 0.85 : 0.5;
        const alpha = Math.min(1, (0.18 + 0.82 * rnd() ** 2) * (mag > 0.9 ? 1 : 0.65) * strength);
        // Most stars are white; a few lean warm or cool, as real ones do.
        g.fillStyle = tint < 0.1 ? `rgba(255, 228, 200, ${alpha})` : tint < 0.28 ? `rgba(204, 222, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        g.beginPath();
        g.arc(x, y, radius, 0, Math.PI * 2);
        g.fill();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [strength]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
