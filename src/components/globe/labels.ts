import type { LngLat, Map as MlMap } from "maplibre-gl";

/**
 * Country and city names drawn as ordinary DOM text over the map.
 * Why DOM and not a MapLibre symbol layer: the browser shapes Arabic (and every other script)
 * correctly by itself, so no right-to-left text plugin, no glyph server and no extra dependency.
 * The data is the small Natural Earth extract in src/data/places.json (public domain).
 */
interface PlacesFile {
  langs: string[];
  /** [lon, lat, minLabelZoom, maxLabelZoom, labelRank, names[]] */
  countries: [number, number, number, number, number, string[]][];
  /** [lon, lat, minZoom, scaleRank, isCapital, names[]] */
  cities: [number, number, number, number, number, string[]][];
}

interface Item {
  lon: number; lat: number; min: number; max: number; priority: number;
  kind: "country" | "city"; major: boolean; names: string[];
  el: HTMLSpanElement; w: number; h: number; on: boolean; ll: LngLat | null;
}

/** Scripts where wide letter-spacing and capitals look right. Never applied to Arabic, Indic or CJK text. */
const SPACED = new Set(["en", "es", "fr", "pt", "id", "sw", "tr", "ru"]);
// Natural Earth zoom hints assume 256 px tiles; MapLibre zoom is about one level lower for the same scale.
const COUNTRY_MIN_SHIFT = -0.6, COUNTRY_MAX_SHIFT = -0.3, CITY_MIN_SHIFT = 0.8, CITY_FLOOR = 3.1;
const GAP = 6; // px of breathing room between two labels
const DOT = 3; // px from the city dot's edge to its centre

export class LabelLayer {
  private root: HTMLDivElement;
  private items: Item[] = [];
  private langs: string[] = ["en"];
  private lang = 0;
  private locale = "en"; // the page language, remembered so names loaded later still use it
  private rtl = false;
  private dirty = true;
  /** true while the map is shown flat (2D): no rim to worry about. */
  flat = false;
  private onRender = () => this.update();

  constructor(private map: MlMap, container: HTMLElement, private makeLngLat: (lon: number, lat: number) => LngLat) {
    this.root = document.createElement("div");
    this.root.className = "fs-labels";
    this.root.setAttribute("aria-hidden", "true"); // decorative: place search is the accessible route
    container.appendChild(this.root);
    map.on("render", this.onRender);
  }

  setPlaces(file: PlacesFile) {
    this.langs = file.langs;
    const make = (kind: Item["kind"], major: boolean): HTMLSpanElement => {
      const el = document.createElement("span");
      el.className = `fs-label fs-label-${kind}${major ? " fs-label-major" : ""}`;
      this.root.appendChild(el);
      return el;
    };
    const countries: Item[] = file.countries.map(([lon, lat, min, max, rank, names], i) => ({
      lon, lat, names, kind: "country", major: rank <= 2,
      min: min + COUNTRY_MIN_SHIFT, max: max + COUNTRY_MAX_SHIFT,
      priority: rank * 100 + i / 10, el: make("country", rank <= 2), w: 0, h: 0, on: false, ll: null,
    }));
    const cities: Item[] = file.cities.map(([lon, lat, min, rank, capital, names], i) => ({
      lon, lat, names, kind: "city", major: rank <= 1 || capital === 1,
      min: Math.max(CITY_FLOOR, min + CITY_MIN_SHIFT), max: 99,
      // big cities rank between the first- and second-tier countries
      priority: 250 + rank * 100 + (capital ? 0 : 20) + i / 10, el: make("city", rank <= 1), w: 0, h: 0, on: false, ll: null,
    }));
    this.items = [...countries, ...cities].sort((a, b) => a.priority - b.priority);
    this.setLocale(this.locale, this.rtl);
  }

  setLocale(locale: string, rtl: boolean) {
    this.locale = locale;
    const i = this.langs.indexOf(locale);
    this.lang = i < 0 ? 0 : i; // no Swahili names in Natural Earth: fall back to English
    this.rtl = rtl;
    this.root.lang = i < 0 ? "en" : locale;
    this.root.dataset.spaced = SPACED.has(locale) ? "1" : "0";
    for (const it of this.items) it.el.textContent = (it.names[this.lang] || it.names[0]).replace(/\s+/g, " ");
    this.dirty = true;
    this.map.triggerRepaint();
    // Web fonts change the measured widths once they arrive.
    document.fonts?.ready.then(() => { this.dirty = true; this.map.triggerRepaint(); }).catch(() => {});
  }

  private measure() {
    for (const it of this.items) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
    this.dirty = false;
  }

  private update() {
    if (!this.items.length) return;
    if (this.dirty) this.measure();
    const map = this.map, zoom = map.getZoom(), center = map.getCenter();
    // A place is hidden behind the planet when the surface seen at its screen position is some other place.
    const tolerance = Math.max(0.3, 4 / 2 ** zoom); // degrees
    const canvas = map.getCanvas(), W = canvas.clientWidth, H = canvas.clientHeight;
    const cLat = (center.lat * Math.PI) / 180, sinC = Math.sin(cLat), cosC = Math.cos(cLat);
    const wide = !this.flat && zoom < 4.5; // on the whole-globe view, drop names that sit on the foreshortened rim
    const placed: number[] = []; // x0, y0, x1, y1 quadruples

    for (const it of this.items) {
      let show = zoom >= it.min && zoom <= it.max;
      let x0 = 0, y0 = 0;
      if (show) {
        // nearest copy of the place to the camera (matters on the flat map, harmless on the globe)
        const lon = it.lon + 360 * Math.round((center.lng - it.lon) / 360);
        if (wide) {
          // cosine of the angle between the place and the point the camera looks at
          const lat = (it.lat * Math.PI) / 180;
          const cos = sinC * Math.sin(lat) + cosC * Math.cos(lat) * Math.cos(((lon - center.lng) * Math.PI) / 180);
          if (cos < 0.3) show = false;
        }
        if (show) {
          if (!it.ll || it.ll.lng !== lon) it.ll = this.makeLngLat(lon, it.lat);
          const p = map.project(it.ll), seen = map.unproject(p);
          const dLon = seen.lng - lon;
          const off = Math.abs(seen.lat - it.lat) + Math.abs(dLon - 360 * Math.round(dLon / 360)) * Math.cos((it.lat * Math.PI) / 180);
          if (off > tolerance) show = false;
          else {
            if (it.kind === "city") { x0 = this.rtl ? p.x - it.w + DOT : p.x - DOT; y0 = p.y - it.h / 2; }
            else { x0 = p.x - it.w / 2; y0 = p.y - it.h / 2; }
            show = x0 + it.w > 0 && x0 < W && y0 + it.h > 0 && y0 < H;
          }
        }
      }
      if (show) {
        const a = x0 - GAP, b = y0 - GAP / 2, c = x0 + it.w + GAP, d = y0 + it.h + GAP / 2;
        for (let i = 0; i < placed.length; i += 4) {
          if (a < placed[i + 2] && c > placed[i] && b < placed[i + 3] && d > placed[i + 1]) { show = false; break; }
        }
        if (show) placed.push(a, b, c, d);
      }
      if (show) it.el.style.transform = `translate(${Math.round(x0)}px, ${Math.round(y0)}px)`;
      if (show !== it.on) { it.on = show; it.el.classList.toggle("is-on", show); }
    }
  }

  destroy() {
    this.map.off("render", this.onRender);
    this.root.remove();
    this.items = [];
  }
}
