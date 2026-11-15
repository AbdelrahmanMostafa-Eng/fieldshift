"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { GeoJSONSource, Map as MlMap, Marker, PaddingOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE_LAYER, OVERLAYS, tileUrl, type GibsLayer } from "@/lib/gibs";
import { easeOutCubic, wrapLon, zoomForGlobeDiameter } from "@/lib/geo";
import type { Box, zonesGeoJson } from "@/lib/zones";
import { FlatFallback } from "./globe/FlatFallback";
import { LabelLayer } from "./globe/labels";
import { GlobeOptics } from "./globe/optics";
import { StarField, type StarFieldHandle } from "./globe/StarField";
import {
  FLAT_STATE, LAYER, PALETTE, TERRAIN_EXAGGERATION, TERRAIN_OFF_ZOOM, TERRAIN_ON_ZOOM,
  buildStyle, overlayId, rasterSource, skyFor, type Theme,
} from "./globe/style";
import { useTheme } from "./globe/useTheme";

export interface GlobeInset { top: number; bottom: number; start: number; end: number }
export interface GlobeOverlay { layer: GibsLayer; opacity: number }
/** Crop suitability squares to draw, the box they cover, and a key that changes when the crop or the place changes. */
export interface GlobeZones { geojson: ReturnType<typeof zonesGeoJson>; box: Box; fitKey: string }

export interface GlobeProps {
  projection: "globe" | "mercator";
  spin: boolean;
  marker: { lat: number; lon: number } | null;
  /** Overlays that are switched on, with their opacity (0..1). */
  overlays: GlobeOverlay[];
  date: string;
  locale: string;
  rtl: boolean;
  /** Screen space covered by other UI, in px. The globe is framed in what is left. */
  inset: GlobeInset;
  /** Lifts the map's corner controls above a bottom sheet. */
  controlsBottom?: number;
  /** Shows the "back to the whole globe" button (hidden during the intro, where the globe is already there). */
  homeVisible?: boolean;
  zones?: GlobeZones | null;
  onPick?: (lat: number, lon: number) => void;
  onUserInteract?: () => void;
  /** Called once when the 3D map cannot run and the flat fallback is shown instead. */
  onUnsupported?: () => void;
}

const START = { lon: 34, lat: 18 };
const SPIN_DEG_PER_MS = 0.002;   // 2 degrees per second
const DOLLY_MS = 4000;           // gentle move-in at the start
const DOLLY_ZOOM = 0.55;         // how much farther away the intro starts
const GLOBE_FILL = 0.84;         // share of the free space the globe fills
const PICK_ZOOM = 8;             // closest view the daily imagery still supports sharply
const PICK_PITCH = 38;           // where 3D terrain runs, a picked place is seen at an angle, so hills read as hills
const STARS_MAX_ZOOM = 4;         // above this the planet covers the whole view
const FLY_MS = 2500;
const FLATTEN_MS = 900;
const HOME_MS = 1800;
const ZONES = { source: "fs-zones", layer: "fs-zones-fill" } as const;
/** Good, possible, poor: green, amber, red, readable on imagery in both themes. */
const ZONE_COLOURS = { good: "#3f9d4a", possible: "#e3b23c", poor: "#c8483a" } as const;
// Same family as ui/Icon: 1.5 stroke on a 20 px grid. A small globe inside a turn-back arrow.
const HOME_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
  + '<path d="M3 10a7 7 0 1 0 2.05-4.95L3 7.1"/><path d="M3 3.2v3.9h3.9"/>'
  + '<circle cx="10" cy="10" r="3.4"/><ellipse cx="10" cy="10" rx="1.4" ry="3.4"/><path d="M6.6 10h6.8"/></svg>';
const MIN_ZOOM = 0.4, MAX_ZOOM = 10.5;

const toPadding = (i: GlobeInset, rtl: boolean): PaddingOptions => ({ top: i.top, bottom: i.bottom, left: rtl ? i.end : i.start, right: rtl ? i.start : i.end });
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Zoom at which the globe fills the free part of the container. */
function fitZoom(el: HTMLElement, pad: PaddingOptions, lat: number): number {
  const w = el.clientWidth - (pad.left ?? 0) - (pad.right ?? 0), h = el.clientHeight - (pad.top ?? 0) - (pad.bottom ?? 0);
  const z = zoomForGlobeDiameter(Math.max(180, Math.min(w, h) * GLOBE_FILL), lat);
  return Math.max(MIN_ZOOM, Math.min(3, z));
}

/**
 * True when a screen point lies on the planet rather than on the space around it.
 * MapLibre snaps a point in space to the nearest point of the horizon, so projecting that back lands elsewhere.
 */
function onSurface(m: MlMap, point: { x: number; y: number }): boolean {
  const back = m.project(m.unproject([point.x, point.y]));
  return Math.hypot(back.x - point.x, back.y - point.y) < 2;
}

function webglSupported(): boolean {
  try {
    // "?webgl=off" forces the fallback, so it can be tested on a machine that does have WebGL.
    if (new URLSearchParams(window.location.search).get("webgl") === "off") return false;
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function Globe({ projection, spin, marker, overlays, date, locale, rtl, inset, controlsBottom = 0, homeVisible = true, zones = null, onPick, onUserInteract, onUnsupported }: GlobeProps) {
  const t = useTranslations("globe");
  const theme = useTheme();
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const labels = useRef<LabelLayer | null>(null);
  const optics = useRef<GlobeOptics | null>(null);
  const stars = useRef<StarFieldHandle>(null);
  const flatness = useRef(0);                 // 0 = globe, 1 = flat map, in between while animating
  const lastMarker = useRef<GlobeProps["marker"]>(null);
  const dolly = useRef({ from: 0, to: 0, t0: 0 });
  const flight = useRef<{ lon: number; lat: number; zoom: number; pitch: number; end: number } | null>(null);
  const relief = useRef(false);               // true where the device draws 3D terrain
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const autoFit = useRef(true);               // true until the user moves the globe or picks a place
  const restartSpin = useRef<() => void>(() => {});
  const homeCtrl = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const ready = status === "ready";
  useEffect(() => { if (status === "unsupported") onUnsupported?.(); }, [status, onUnsupported]);

  // Latest props for the long-lived map callbacks, without re-creating the map.
  const live = useRef({ spin, onPick, onUserInteract, date, theme, inset, rtl, locale, t });
  useEffect(() => { live.current = { spin, onPick, onUserInteract, date, theme, inset, rtl, locale, t }; });

  // ---- create the map once -------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false, raf = 0, last = 0;
    let m: MlMap | undefined;
    const root = wrap.current;
    const reduce = prefersReducedMotion();

    const touched = () => { autoFit.current = false; live.current.onUserInteract?.(); };
    const tick = (now: number) => {
      raf = 0;
      if (!m || !live.current.spin || document.hidden) return; // the loop ends itself; restartSpin() revives it
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      const d = dolly.current;
      if (!d.t0) d.t0 = now;
      const c = m.getCenter();
      // Decreasing longitude turns the surface eastward, the way Earth really spins.
      m.jumpTo({ center: [wrapLon(c.lng - dt * SPIN_DEG_PER_MS), c.lat], zoom: d.from + (d.to - d.from) * easeOutCubic((now - d.t0) / DOLLY_MS) });
      raf = requestAnimationFrame(tick);
    };
    const startSpin = () => { if (!raf && m && live.current.spin && !reduce && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
    restartSpin.current = startSpin;
    const onVisibility = () => { if (!document.hidden) startSpin(); };

    (async () => {
      if (!webglSupported()) { setStatus("unsupported"); return; }
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        // MapLibre 6 looks for its worker next to its own module, which the bundler does not serve.
        // scripts/copy-maplibre-worker.mjs puts a copy in public/ before dev and build.
        ml.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
        lib.current = ml;

        const pad = toPadding(live.current.inset, live.current.rtl);
        const target = fitZoom(el.current, pad, START.lat);
        const moving = live.current.spin && !reduce;
        dolly.current = { from: moving ? target - DOLLY_ZOOM : target, to: target, t0: 0 };
        const finePointer = window.matchMedia("(pointer: fine)").matches;

        m = new ml.Map({
          container: el.current,
          style: buildStyle(live.current.date, live.current.theme),
          center: [START.lon, START.lat],
          zoom: dolly.current.from,
          minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, maxPitch: 70,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2), // sharp enough, and far cheaper on 3x phones
          attributionControl: false,
          // MapLibre's own control and canvas labels, in the page language (Map.Title names the canvas for screen readers).
          locale: {
            "Map.Title": live.current.t("label"), "NavigationControl.ZoomIn": live.current.t("zoomIn"), "NavigationControl.ZoomOut": live.current.t("zoomOut"),
            "NavigationControl.ResetBearing": live.current.t("north"), "AttributionControl.ToggleAttribution": live.current.t("credits"),
          },
          dragPan: { linearity: 0.2, deceleration: 2200, maxSpeed: 1600 }, // a little heavier than the default: the globe glides, then settles
        });
        map.current = m;
        m.setPadding(pad);
        const corner = live.current.rtl ? "bottom-left" : "bottom-right";
        m.addControl(new ml.AttributionControl({ compact: true }), corner);
        if (finePointer) m.addControl(new ml.NavigationControl({ visualizePitch: true }), corner);

        // "Back to the whole globe": undoes any zoom, turn or tilt, on every device (phones have no other map buttons).
        // Added last, so it sits on top of the corner stack.
        const homeBox = document.createElement("div");
        homeBox.className = "maplibregl-ctrl maplibregl-ctrl-group fs-home-ctrl";
        homeBox.hidden = true;
        const homeBtn = document.createElement("button");
        homeBtn.type = "button";
        homeBtn.className = "fs-home";
        homeBtn.setAttribute("aria-label", live.current.t("home"));
        homeBtn.title = live.current.t("home");
        homeBtn.innerHTML = HOME_ICON;
        homeBtn.addEventListener("click", () => {
          const mm = map.current, box = el.current;
          if (!mm || !box) return;
          const pad = toPadding(live.current.inset, live.current.rtl);
          // With a place picked, the whole globe turns to face it, so the pin stays in sight.
          const c = lastMarker.current ?? START;
          flight.current = null;
          autoFit.current = true; // from here on the globe keeps fitting the free space again
          mm.stop();
          mm.flyTo({ center: [c.lon, c.lat], zoom: fitZoom(box, pad, c.lat), bearing: 0, pitch: 0, padding: pad, curve: 1.2, easing: easeInOut, duration: prefersReducedMotion() ? 0 : HOME_MS, essential: true });
        });
        homeBox.appendChild(homeBtn);
        m.addControl({ onAdd: () => homeBox, onRemove: () => homeBox.remove() }, corner);
        homeCtrl.current = homeBox;

        // A missing or failed tile (GIBS answers 500 for some tiles with no data) is not worth an error:
        // the map simply keeps what it has. Anything else is still reported.
        m.on("error", (e) => {
          if ((e as { sourceId?: string }).sourceId || (e as { tile?: unknown }).tile) return;
          console.warn("map:", e.error?.message ?? e);
        });

        m.on("click", (e) => {
          if (!m || !onSurface(m, e.point)) return; // a click on space is not a place
          live.current.onPick?.(e.lngLat.lat, wrapLon(e.lngLat.lng));
        });
        // Crosshair over the planet, grab over space. Written only when it changes.
        let over = "";
        m.on("mousemove", (e) => {
          const next = m && onSurface(m, e.point) ? "globe" : "space";
          if (next !== over && root) { over = next; root.dataset.over = next; }
        });

        // 3D terrain only from field-ish zooms, and only where it is likely to stay smooth.
        const capable = finePointer && window.innerWidth >= 768 && (navigator.hardwareConcurrency ?? 4) >= 4;
        relief.current = capable;
        let terrainOn = false;
        const syncTerrain = () => {
          if (!m || !capable) return;
          const z = m.getZoom();
          if (!terrainOn && z >= TERRAIN_ON_ZOOM) { terrainOn = true; m.setTerrain({ source: "dem-terrain", exaggeration: TERRAIN_EXAGGERATION }); }
          else if (terrainOn && z < TERRAIN_OFF_ZOOM) { terrainOn = false; m.setTerrain(null); }
        };
        m.on("zoom", syncTerrain);
        // The sky behind turns with the camera, a little, which is what gives the scene its depth.
        // Skipped once the planet fills the view and no sky is left to see.
        m.on("move", () => { if (m && m.getZoom() < STARS_MAX_ZOOM) { const c = m.getCenter(); stars.current?.turn(c.lng + m.getBearing(), c.lat); } });

        m.once("load", async () => {
          if (cancelled || !m || !el.current) return;
          optics.current = new GlobeOptics(m, live.current.theme);
          optics.current.flatness = flatness.current;
          setStatus("ready");
          startSpin();
          try {
            const places = (await import("@/data/places.json")).default;
            if (cancelled || !m) return;
            const layer = new LabelLayer(m, el.current, (lon, lat) => new ml.LngLat(lon, lat));
            layer.flat = flatness.current >= 0.5;
            layer.setLocale(live.current.locale, live.current.rtl);
            layer.setPlaces(places as unknown as Parameters<LabelLayer["setPlaces"]>[0]);
            labels.current = layer;
          } catch { /* labels are a nicety: the globe works without them */ }
        });
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();

    // Any press, wheel or key inside the globe (canvas or its buttons) hands control to the user.
    root?.addEventListener("pointerdown", touched, { passive: true });
    root?.addEventListener("wheel", touched, { passive: true });
    root?.addEventListener("keydown", touched);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      root?.removeEventListener("pointerdown", touched);
      root?.removeEventListener("wheel", touched);
      root?.removeEventListener("keydown", touched);
      document.removeEventListener("visibilitychange", onVisibility);
      labels.current?.destroy(); labels.current = null;
      optics.current?.destroy(); optics.current = null;
      pin.current?.remove(); pin.current = null;
      homeCtrl.current = null;
      m?.remove(); map.current = null;
      lastMarker.current = null;
      flatness.current = 0;
      setStatus((s) => (s === "unsupported" ? s : "loading"));
    };
  }, []);

  useEffect(() => { if (spin) restartSpin.current(); }, [spin]);

  // ---- globe <-> flat, animated; the limb glow fades with it -----------------------------------
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const to = projection === "mercator" ? 1 : 0, from = flatness.current;
    const apply = (f: number) => {
      flatness.current = f;
      m.setGlobalStateProperty(FLAT_STATE, f); // the projection and the limb glow both read this (see globe/style.ts)
      if (labels.current) labels.current.flat = f >= 0.5;
      if (optics.current) optics.current.flatness = f;
    };
    if (from === to) return;
    if (prefersReducedMotion()) { apply(to); return; }
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / FLATTEN_MS);
      apply(k >= 1 ? to : from + (to - from) * easeInOut(k));
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [projection, ready]);

  // ---- theme: two designed palettes -------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setSky(skyFor(theme as Theme));
    m.setPaintProperty(LAYER.ground, "background-color", PALETTE[theme].ground);
    optics.current?.setTheme(theme);
  }, [theme, ready]);

  // ---- overlays: added on first use, then only shown, hidden or re-tinted -----------------------
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const layer of OVERLAYS) {
      const id = overlayId(layer), on = overlays.find((o) => o.layer.id === layer.id);
      if (!on) { if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none"); continue; }
      if (!m.getSource(id)) m.addSource(id, rasterSource(layer, live.current.date));
      if (!m.getLayer(id)) m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": on.opacity, "raster-fade-duration": 300 } }, LAYER.hillshade);
      else { m.setLayoutProperty(id, "visibility", "visible"); m.setPaintProperty(id, "raster-opacity", on.opacity); }
    }
    if (m.getLayer(ZONES.layer)) m.moveLayer(ZONES.layer, LAYER.hillshade); // zones stay above any satellite layer
  }, [overlays, ready]);

  // ---- crop suitability zones: coloured grid squares, framed once per crop and place ---------------------
  const lastZoneFit = useRef("");
  useEffect(() => {
    const m = map.current, box = el.current;
    if (!ready || !m || !box) return;
    if (!zones) {
      if (m.getLayer(ZONES.layer)) m.setLayoutProperty(ZONES.layer, "visibility", "none");
      lastZoneFit.current = "";
      return;
    }
    const src = m.getSource(ZONES.source) as GeoJSONSource | undefined;
    if (src) src.setData(zones.geojson);
    else m.addSource(ZONES.source, { type: "geojson", data: zones.geojson });
    if (!m.getLayer(ZONES.layer)) {
      m.addLayer({
        id: ZONES.layer, type: "fill", source: ZONES.source,
        paint: { "fill-color": ["match", ["get", "level"], "good", ZONE_COLOURS.good, "possible", ZONE_COLOURS.possible, ZONE_COLOURS.poor], "fill-opacity": 0.5, "fill-antialias": false },
      }, LAYER.hillshade);
    } else m.setLayoutProperty(ZONES.layer, "visibility", "visible");
    if (lastZoneFit.current !== zones.fitKey) {
      lastZoneFit.current = zones.fitKey;
      autoFit.current = false;
      const b = zones.box, pad = toPadding(live.current.inset, live.current.rtl);
      m.fitBounds([[b.lonMin, b.latMin], [b.lonMax, b.latMax]], { padding: { top: (pad.top ?? 0) + 24, bottom: (pad.bottom ?? 0) + 24, left: (pad.left ?? 0) + 24, right: (pad.right ?? 0) + 24 }, duration: prefersReducedMotion() ? 0 : 1600, essential: true });
    }
  }, [zones, ready]);

  // ---- date: swap the tile addresses of every dated source ---------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const retile = (id: string, l: GibsLayer) => (m.getSource(id) as unknown as { setTiles(t: string[]): void } | undefined)?.setTiles([tileUrl(l, date)]);
    retile(LAYER.daily, BASE_LAYER);
    for (const l of OVERLAYS) retile(overlayId(l), l);
  }, [date, ready]);

  // ---- labels follow the page language -----------------------------------------------------------
  useEffect(() => { if (ready) labels.current?.setLocale(locale, rtl); }, [locale, rtl, ready]);

  // ---- camera: framing, and the flight to a picked place ----------------------------------------
  const { top, bottom, start, end } = inset;
  useEffect(() => {
    const m = map.current, box = el.current;
    if (!ready || !m || !box) return;
    const pad = toPadding({ top, bottom, start, end }, rtl);
    const reduce = prefersReducedMotion();
    const picked = marker !== lastMarker.current;
    lastMarker.current = marker;

    if (picked) {
      pin.current?.remove(); pin.current = null;
      flight.current = null;
      autoFit.current = false;
      const ml = lib.current;
      if (marker && ml) {
        // The outer element belongs to MapLibre (it positions it); the pin is drawn inside.
        const holder = document.createElement("div");
        holder.innerHTML = '<span class="fs-pin"><span class="fs-pin-ring"></span><span class="fs-pin-dot"></span></span>';
        // opacityWhenCovered also hides the pin when it is on the far side of the globe
        pin.current = new ml.Marker({ element: holder, anchor: "center", opacityWhenCovered: "0" }).setLngLat([marker.lon, marker.lat]).addTo(m);
        const zoom = Math.max(PICK_ZOOM, m.getZoom());
        // Never flatten a view the user has already tilted further themselves.
        const pitch = flatness.current < 0.5 && relief.current ? Math.max(PICK_PITCH, m.getPitch()) : m.getPitch();
        flight.current = { lon: marker.lon, lat: marker.lat, zoom, pitch, end: performance.now() + (reduce ? 0 : FLY_MS) };
        m.flyTo({ center: [marker.lon, marker.lat], zoom, pitch, padding: pad, duration: reduce ? 0 : FLY_MS, curve: 1.3, easing: easeInOut, essential: true });
        return;
      }
    }
    const f = flight.current;
    if (f && performance.now() < f.end - 60) {
      // The layout changed while flying to a picked place (the panel opened): keep flying, with the new framing.
      m.flyTo({ center: [f.lon, f.lat], zoom: f.zoom, pitch: f.pitch, padding: pad, duration: f.end - performance.now(), curve: 1.3, easing: easeOutCubic, essential: true });
    } else if (live.current.spin && !reduce) {
      // Still in the intro: re-frame without fighting the spin loop.
      m.setPadding(pad);
      dolly.current.to = fitZoom(box, pad, m.getCenter().lat);
      if (!dolly.current.t0) dolly.current.from = dolly.current.to - DOLLY_ZOOM;
    } else {
      // Until the user has moved the globe themselves, keep it sized to the free space (panel opened, sheet dragged, window resized).
      const zoom = autoFit.current ? { zoom: fitZoom(box, pad, m.getCenter().lat) } : {};
      m.easeTo({ padding: pad, ...zoom, duration: reduce ? 0 : 600, essential: true });
    }
  }, [marker, top, bottom, start, end, rtl, ready]);

  // ---- the home button shows once the intro is over ---------------------------------------------
  useEffect(() => { if (ready && homeCtrl.current) homeCtrl.current.hidden = !homeVisible; }, [homeVisible, ready]);

  // ---- map corner controls sit at the reading-end side -------------------------------------------
  useEffect(() => {
    const box = el.current;
    if (!ready || !box) return;
    const from = rtl ? "maplibregl-ctrl-bottom-right" : "maplibregl-ctrl-bottom-left";
    const to = rtl ? "maplibregl-ctrl-bottom-left" : "maplibregl-ctrl-bottom-right";
    const a = box.querySelector(`.${from}`), b = box.querySelector(`.${to}`);
    if (a && b) while (a.firstChild) b.appendChild(a.firstChild);
  }, [rtl, ready]);

  return (
    <div ref={wrap} className="fs-globe absolute inset-0" data-ready={ready} style={{ ["--fs-ctrl-bottom" as string]: `${controlsBottom}px` }}>
      <StarField ref={stars} strength={PALETTE[theme].stars} />
      {status === "unsupported" ? (
        <FlatFallback marker={marker} message={t("noWebgl")} label={t("flatLabel")} inset={inset} onPick={(lat, lon) => { onUserInteract?.(); onPick?.(lat, lon); }} />
      ) : (
        // MapLibre's own stylesheet makes this element position:relative, so it needs an explicit size
        // (absolute + inset would be overridden and collapse to zero height).
        <div ref={el} className="h-full w-full" role="application" aria-label={t("label")} />
      )}
      {status === "loading" && <p role="status" className="sr-only">{t("loading")}</p>}
    </div>
  );
}
