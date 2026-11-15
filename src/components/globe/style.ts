import type { ExpressionSpecification, RasterSourceSpecification, SkySpecification, StyleSpecification } from "maplibre-gl";
import { BASE_LAYER, BLUE_MARBLE, GIBS_CREDIT, SHARP_LAYER, TERRAIN, type GibsLayer } from "@/lib/gibs";
import { sunLightPosition } from "./optics";
import { tilesFor } from "./tiles";

export type Theme = "light" | "dark";

/**
 * Two designed palettes, not one inverted.
 * dark  = deep night: near-black space, a thin teal limb.
 * light = blue hour: slate-blue space, a fuller, paler limb.
 * `sky` colours show above the horizon when the camera is tilted; the globe's limb glow itself is
 * MapLibre's scattering model, so only its strength (`atmosphere`) can be tuned.
 */
export const PALETTE: Record<Theme, {
  ground: string; atmosphere: number; stars: number;
  sky: Pick<SkySpecification, "sky-color" | "horizon-color" | "fog-color" | "sky-horizon-blend" | "horizon-fog-blend" | "fog-ground-blend">;
}> = {
  dark: {
    ground: "#0a1622", atmosphere: 0.62, stars: 1,
    sky: { "sky-color": "#06101c", "horizon-color": "#4f97a6", "fog-color": "#14283a", "sky-horizon-blend": 0.75, "horizon-fog-blend": 0.55, "fog-ground-blend": 0.35 },
  },
  light: {
    ground: "#12293b", atmosphere: 0.86, stars: 0.6,
    sky: { "sky-color": "#3f7fb5", "horizon-color": "#cfe6ea", "fog-color": "#dbe8ea", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.25 },
  },
};

/**
 * One number in the map's own state drives the globe-to-flat change: 0 = globe, 1 = flat map.
 * Changing it with `map.setGlobalStateProperty` is cheap. Calling `setProjection` instead rebuilds the
 * projection and reloads every tile, which made the animation stutter when it was done once per frame.
 */
export const FLAT_STATE = "flat";
const GLOBENESS: ExpressionSpecification = ["-", 1, ["global-state", FLAT_STATE]];

export function skyFor(theme: Theme): SkySpecification {
  const p = PALETTE[theme];
  const a = p.atmosphere;
  return {
    ...p.sky,
    // Full glow on the wide view, gone by field scale where it would only wash out the imagery,
    // and fading with the globe itself (no limb glow on the flat map).
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, ["*", a, GLOBENESS], 4, ["*", a * 0.8, GLOBENESS], 6.5, 0],
  };
}

const TERRAIN_ATTR = `<a href="${TERRAIN.source}" target="_blank" rel="noreferrer">© AWS Terrain Tiles</a>`;

/**
 * `crisp`: on screens with two or more device pixels per CSS pixel, a 256 px tile drawn at 256 CSS px is stretched
 * to twice its size and looks soft. Declaring the tiles as 128 px makes MapLibre fetch one level deeper, so
 * picture pixels and screen pixels line up again. Only used for the base imagery, where sharpness is the point.
 */
export const rasterSource = (l: GibsLayer, date: string, crisp = false): RasterSourceSpecification => ({
  type: "raster", tiles: tilesFor(l, date), tileSize: crisp ? 128 : 256, maxzoom: l.maxZoom, attribution: GIBS_CREDIT,
});

const demSource = () => ({
  type: "raster-dem" as const, tiles: [TERRAIN.tiles], tileSize: 256, maxzoom: TERRAIN.maxZoom, encoding: "terrarium" as const, attribution: TERRAIN_ATTR,
});

/** Layer ids, bottom to top. Overlays are inserted just below `hillshade`. */
export const LAYER = { ground: "ground", blueMarble: "bluemarble", daily: "viirs", sharp: "landsat", hillshade: "hillshade" } as const;
/** The three imagery layers, widest view first. */
export const IMAGERY = [LAYER.blueMarble, LAYER.daily, LAYER.sharp] as const;
/** The 30 m mosaic fades in over this zoom range, where the 250 m daily image starts to look soft. */
export const SHARP_FROM_ZOOM = 6.8, SHARP_FULL_ZOOM = 7.8;

/**
 * Colour of the imagery. Normally the wide view is toned down a little (a planet seen through air) and the close view
 * is left alone, since colour is information there. Under a data layer the imagery goes nearly grey and a bit darker,
 * so the data's colours are the only colours on the map and match their legend.
 */
export function imageryTone(layer: (typeof IMAGERY)[number], underData: boolean): { saturation: ExpressionSpecification | number; contrast: ExpressionSpecification | number; brightness: number } {
  if (underData) return { saturation: -0.82, contrast: -0.08, brightness: 0.78 };
  if (layer !== LAYER.blueMarble) return { saturation: 0, contrast: 0, brightness: 1 };
  return {
    saturation: ["interpolate", ["linear"], ["zoom"], 2.5, -0.1, 4.5, 0],
    contrast: ["interpolate", ["linear"], ["zoom"], 2.5, 0.04, 4.5, 0],
    brightness: 1,
  };
}
export const overlayId = (l: GibsLayer) => `ov-${l.key}`;
/** Hillshade starts here, so the wide view downloads no elevation tiles at all. */
export const RELIEF_MIN_ZOOM = 4.5;
/** 3D terrain switches on above the first value and off below the second (hysteresis avoids flapping). */
export const TERRAIN_ON_ZOOM = 5.2;
export const TERRAIN_OFF_ZOOM = 4.8;
export const TERRAIN_EXAGGERATION = 1.3;

export function buildStyle(date: string, theme: Theme, crisp = false): StyleSpecification {
  const wide = imageryTone(LAYER.blueMarble, false);
  return {
    version: 8,
    state: { [FLAT_STATE]: { default: 0 } },
    projection: { type: ["interpolate", ["linear"], ["global-state", FLAT_STATE], 0, "vertical-perspective", 1, "mercator"] },
    sources: {
      bluemarble: rasterSource(BLUE_MARBLE, date, crisp),
      viirs: rasterSource(BASE_LAYER, date, crisp),
      landsat: rasterSource(SHARP_LAYER, date, crisp),
      // Same tiles twice: MapLibre wants separate sources for hillshade and for 3D terrain.
      "dem-hill": demSource(),
      "dem-terrain": demSource(),
    },
    layers: [
      // No background for space: the canvas stays transparent there so the star field shows through.
      // This fill only colours the sphere itself while imagery is still loading.
      { id: LAYER.ground, type: "background", paint: { "background-color": PALETTE[theme].ground } },
      {
        id: LAYER.blueMarble, type: "raster", source: "bluemarble",
        paint: { "raster-fade-duration": 350, "raster-saturation": wide.saturation, "raster-contrast": wide.contrast },
      },
      {
        // Daily imagery has clouds and swath gaps, so it only fades in once the user moves closer.
        id: LAYER.daily, type: "raster", source: "viirs", minzoom: 2.4,
        paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 2.4, 0, 3.6, 1], "raster-fade-duration": 350 },
      },
      {
        // Field scale: the 30 m mosaic takes over from the 250 m daily image, which stays underneath for any gap.
        id: LAYER.sharp, type: "raster", source: "landsat", minzoom: SHARP_FROM_ZOOM,
        paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], SHARP_FROM_ZOOM, 0, SHARP_FULL_ZOOM, 1], "raster-fade-duration": 350 },
      },
      {
        id: LAYER.hillshade, type: "hillshade", source: "dem-hill", minzoom: RELIEF_MIN_ZOOM,
        paint: {
          "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], RELIEF_MIN_ZOOM, 0, 6, 0.3, 10, 0.42],
          "hillshade-shadow-color": "rgba(6, 12, 18, 0.85)",
          "hillshade-highlight-color": "rgba(255, 246, 226, 0.45)",
          "hillshade-accent-color": "rgba(6, 12, 18, 0.35)",
          "hillshade-illumination-direction": 315,
          "hillshade-illumination-anchor": "map",
        },
      },
    ],
    sky: skyFor(theme),
    // Only MapLibre's atmosphere reads this: it puts the sun where globe/optics.ts lights the sphere from.
    light: { anchor: "viewport", position: sunLightPosition(), intensity: 0.5 },
  };
}
