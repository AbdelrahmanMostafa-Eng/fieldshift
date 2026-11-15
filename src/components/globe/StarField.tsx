"use client";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

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

export interface StarFieldHandle {
  /** Turn the sky to match the camera: longitude and latitude of the point the globe is centred on, in degrees. */
  turn(lon: number, lat: number): void;
}

// Two depths. The far layer barely moves when the globe turns; the near one moves a little more. That difference is the depth.
const LAYERS = [
  { share: 0.74, px: 0.9, bright: false },
  { share: 0.26, px: 2.1, bright: true },
] as const;

interface Sky { tiles: HTMLCanvasElement[]; w: number; h: number; dpr: number; lon: number; lat: number; raf: number }

/** Copies the star tiles onto the visible canvas, slid by the camera's turn. */
function compose(c: HTMLCanvasElement | null, s: Sky) {
  s.raf = 0;
  const g = c?.getContext("2d");
  if (!c || !g || !s.w) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const W = c.width, H = c.height;
  s.tiles.forEach((tile, i) => {
    const k = LAYERS[i].px * s.dpr;
    // The surface turns one way, the sky behind it appears to drift the other.
    const ox = (((s.lon * k) % W) + W) % W, oy = (((-s.lat * k * 0.6) % H) + H) % H;
    for (const dx of [ox - W, ox]) for (const dy of [oy - H, oy]) g.drawImage(tile, Math.round(dx), Math.round(dy));
  });
}

/**
 * A fine star field behind the transparent map canvas.
 * Each depth is drawn once into its own tile; turning the globe only slides the tiles (they wrap), so a frame costs a few image copies.
 * A faint band of denser, dimmer stars crosses the sky at an angle, as the Milky Way does.
 */
export function StarField({ strength, ref }: { strength: number; ref?: Ref<StarFieldHandle> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<Sky>({ tiles: [], w: 0, h: 0, dpr: 1, lon: 0, lat: 0, raf: 0 });

  useImperativeHandle(ref, () => ({
    turn(lon, lat) {
      const s = state.current;
      if (lon === s.lon && lat === s.lat) return;
      s.lon = lon; s.lat = lat;
      if (!s.raf) s.raf = requestAnimationFrame(() => compose(canvas.current, s));
    },
  }));

  useEffect(() => {
    const c = canvas.current, s = state.current;
    if (!c) return;
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      s.w = w; s.h = h; s.dpr = dpr;
      const rnd = mulberry32(20261115);
      const total = Math.round((w * h) / 2100);
      // The band: a line through the frame at about 28 degrees. Stars are pulled towards it with a soft falloff.
      const ang = (-28 * Math.PI) / 180, nx = -Math.sin(ang), ny = Math.cos(ang), spread = Math.min(w, h) * 0.16;
      s.tiles = LAYERS.map((layer) => {
        const tile = document.createElement("canvas");
        tile.width = c.width; tile.height = c.height;
        const g = tile.getContext("2d");
        if (!g) return tile;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dot = (x: number, y: number, radius: number, colour: string) => {
          // Stars near an edge are drawn on the far side too, so the tile wraps without a seam.
          for (const dx of [0, x < 4 ? w : x > w - 4 ? -w : NaN]) for (const dy of [0, y < 4 ? h : y > h - 4 ? -h : NaN]) {
            if (Number.isNaN(dx) || Number.isNaN(dy)) continue;
            g.fillStyle = colour;
            g.beginPath(); g.arc(x + dx, y + dy, radius, 0, Math.PI * 2); g.fill();
          }
        };
        const count = Math.round(total * layer.share);
        for (let i = 0; i < count; i++) {
          const x = rnd() * w, y = rnd() * h, mag = rnd(), tint = rnd();
          const big = layer.bright && mag > 0.93;
          const radius = big ? 1.25 : layer.bright ? 0.85 : 0.5;
          const alpha = Math.min(1, (0.18 + 0.82 * rnd() ** 2) * (layer.bright ? 1 : 0.62) * strength);
          // Most stars are white; a few lean warm or cool, as real ones do.
          const rgb = tint < 0.1 ? "255, 228, 200" : tint < 0.28 ? "204, 222, 255" : "255, 255, 255";
          dot(x, y, radius, `rgba(${rgb}, ${alpha})`);
          if (big) dot(x, y, 2.6, `rgba(${rgb}, ${alpha * 0.12})`); // the brightest few bloom a little, as in a long exposure
        }
        if (!layer.bright) {
          // Milky Way: many very faint points, densest along the band. No painted glow, only stars.
          const extra = Math.round(total * 1.5);
          for (let i = 0; i < extra; i++) {
            const along = rnd(), off = (rnd() + rnd() + rnd() - 1.5) * spread; // roughly bell-shaped
            const cx = along * w * 1.4 - w * 0.2, cy = h * 0.46 + (along - 0.5) * w * Math.tan(ang);
            const x = (((cx + nx * off) % w) + w) % w, y = (((cy + ny * off) % h) + h) % h;
            dot(x, y, 0.42, `rgba(214, 224, 255, ${(0.05 + 0.2 * rnd() ** 2) * strength})`);
          }
        }
        return tile;
      });
      compose(c, s);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => { ro.disconnect(); cancelAnimationFrame(s.raf); s.raf = 0; };
  }, [strength]);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
