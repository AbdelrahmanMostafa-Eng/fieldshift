import type { Map as MlMap } from "maplibre-gl";
import type { Theme } from "./style";

/**
 * Sunlight on the globe.
 * MapLibre draws the planet evenly lit, like a printed map wrapped on a ball. This adds what a camera in orbit
 * would see: a day side and a soft terminator, haze that thickens towards the limb, a faint glint where the sun
 * reflects, and a thin line of air outside the edge.
 *
 * The light is fixed to the viewer (a key light from the upper left), so the place being looked at is always lit.
 * The picture is computed once per theme into a small canvas, then only moved and scaled as the camera moves.
 * It fades out as the user comes closer (no limb in view, and imagery must stay true to its colours) and on the flat map.
 */

/** Direction to the sun in view space: x to the right, y up, z towards the viewer. Unit length. */
export const SUN: [number, number, number] = (() => {
  const v = [-0.5, 0.42, 0.757], l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/**
 * The same direction as a MapLibre `light.position` ([radial, azimuthal, polar], degrees) with `anchor: "viewport"`,
 * so MapLibre's own atmosphere is lit from the side this overlay lights. MapLibre turns the position into a vector with
 * x = cos(az + 90°)·sin(polar), y = sin(az + 90°)·sin(polar), z = cos(polar) and uses its opposite as the direction to the sun.
 * (Checked on screen: with the other sign the planet is back-lit, a bright crescent on the far side.)
 */
export function sunLightPosition(): [number, number, number] {
  const [x, y, z] = [-SUN[0], -SUN[1], -SUN[2]];
  const polar = (Math.acos(z) * 180) / Math.PI;
  const az = (Math.atan2(y, x) * 180) / Math.PI - 90;
  return [1.5, ((az % 360) + 360) % 360, polar];
}

const TEX = 720;          // texture size, px. Gradients only, so it scales up cleanly.
const MARGIN = 1.22;      // texture half-width in globe radii: room for the air outside the limb
const FADE_FROM = 2.6, FADE_TO = 4.6; // zoom range over which the lighting fades away
const MAX_PITCH = 25;     // the limb is no longer a circle once the camera tilts

interface Look { night: number; shade: [number, number, number]; haze: [number, number, number]; hazeAmount: number; air: [number, number, number]; airAmount: number; glint: number }
const LOOK: Record<Theme, Look> = {
  // deep night: a real shadow side, thin cold air
  dark: { night: 0.8, shade: [3, 6, 14], haze: [150, 196, 255], hazeAmount: 0.5, air: [118, 176, 255], airAmount: 0.5, glint: 0.13 },
  // blue hour: a gentler shadow so the whole disc stays readable, fuller pale air
  light: { night: 0.62, shade: [10, 20, 38], haze: [196, 224, 255], hazeAmount: 0.56, air: [176, 214, 255], airAmount: 0.6, glint: 0.1 },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Draws the lighting picture: straight (not premultiplied) RGBA, which is what putImageData expects. */
function paint(canvas: HTMLCanvasElement, look: Look) {
  const g = canvas.getContext("2d");
  if (!g) return;
  const img = g.createImageData(TEX, TEX), d = img.data;
  const [lx, ly, lz] = SUN;
  // half vector between the sun and the viewer, for the glint
  const hl = Math.hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;
  const sunXY = Math.hypot(lx, ly);
  for (let j = 0; j < TEX; j++) {
    const y = -(((j + 0.5) / TEX) * 2 - 1) * MARGIN;
    for (let i = 0; i < TEX; i++) {
      const x = (((i + 0.5) / TEX) * 2 - 1) * MARGIN;
      const rr = x * x + y * y, o = (j * TEX + i) * 4;
      let r = 0, gg = 0, b = 0, a = 0;
      // `over` one more layer of colour c with opacity k
      const over = (c: [number, number, number], k: number) => {
        if (k <= 0) return;
        const na = k + a * (1 - k);
        r = (c[0] * k + r * a * (1 - k)) / na; gg = (c[1] * k + gg * a * (1 - k)) / na; b = (c[2] * k + b * a * (1 - k)) / na; a = na;
      };
      if (rr <= 1) {
        const z = Math.sqrt(1 - rr);
        const lambert = x * lx + y * ly + z * lz;
        const day = smooth(-0.2, 0.42, lambert); // air scatters light past the geometric edge of day
        over(look.shade, (1 - day) * look.night);
        // Haze: the line of sight crosses more air towards the limb. Brighter on the day side.
        over(look.haze, Math.pow(1 - z, 3.4) * look.hazeAmount * (0.22 + 0.78 * day));
        const spec = Math.max(0, x * hx + y * hy + z * hz);
        over([255, 250, 240], (Math.pow(spec, 90) * 0.8 + Math.pow(spec, 14) * 0.28) * look.glint);
        // one soft pixel at the very edge, so the disc never shows a hard cut
        a *= smooth(1, 0.992, Math.sqrt(rr));
      } else {
        const rad = Math.sqrt(rr), t = rad - 1;
        const facing = sunXY > 0 ? (x * lx + y * ly) / (rad * sunXY) : 0; // 1 on the sunward side of the rim, -1 opposite
        // Night reaches a hair past the edge, so the air MapLibre draws there does not glow on the dark side.
        over(look.shade, (1 - smooth(-0.2, 0.42, facing * sunXY)) * look.night * Math.exp(-t / 0.014));
        const lit = 0.1 + 0.9 * smooth(-0.6, 0.75, facing);
        over(look.air, (Math.exp(-t / 0.011) * 0.6 + Math.exp(-t / 0.06) * 0.16) * look.airAmount * lit * smooth(MARGIN - 1, (MARGIN - 1) * 0.6, t));
      }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
}

export class GlobeOptics {
  private canvas: HTMLCanvasElement;
  private shown = false;
  /** 0 = globe, 1 = flat map. */
  flatness = 0;
  private onRender = () => this.update();

  constructor(private map: MlMap, theme: Theme) {
    const c = document.createElement("canvas");
    c.width = c.height = TEX;
    c.className = "fs-optics";
    c.setAttribute("aria-hidden", "true");
    this.canvas = c;
    // Straight after the map canvas: above the imagery, below the pin and the place names.
    const holder = map.getCanvasContainer();
    holder.insertBefore(c, map.getCanvas().nextSibling);
    this.setTheme(theme);
    map.on("render", this.onRender);
    this.update();
  }

  setTheme(theme: Theme) { paint(this.canvas, LOOK[theme]); }

  private update() {
    const m = this.map, zoom = m.getZoom();
    const strength = (1 - this.flatness) * (1 - smooth(FADE_FROM, FADE_TO, zoom)) * (1 - smooth(4, MAX_PITCH, m.getPitch()));
    if (strength <= 0.004) {
      if (this.shown) { this.shown = false; this.canvas.style.opacity = "0"; }
      return;
    }
    const center = m.getCenter(), h = m.getCanvas().clientHeight;
    // MapLibre's sphere: radius worldSize / (2π cos φ), seen by a camera that sits `dist` px above the centre point.
    const R = (512 * 2 ** zoom) / (2 * Math.PI * Math.cos((center.lat * Math.PI) / 180));
    const dist = (0.5 * h) / Math.tan((m.getVerticalFieldOfView() * Math.PI) / 360);
    const limb = (dist * R) / Math.sqrt(dist * dist + 2 * R * dist); // radius of the disc as drawn, with perspective
    const p = m.project(center);
    const scale = (limb * 2 * MARGIN) / TEX;
    this.canvas.style.transform = `translate(${(p.x - TEX / 2).toFixed(2)}px, ${(p.y - TEX / 2).toFixed(2)}px) scale(${scale.toFixed(5)})`;
    this.canvas.style.opacity = strength.toFixed(3);
    this.shown = true;
  }

  destroy() {
    this.map.off("render", this.onRender);
    this.canvas.remove();
  }
}
