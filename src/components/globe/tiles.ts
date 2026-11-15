import { tileUrl, type GibsLayer } from "@/lib/gibs";

/**
 * Tile addresses for the globe, and the clean-up of imagery that has no transparency.
 *
 * NASA's true-colour imagery comes as JPEG. JPEG cannot say "nothing here", so places the satellite did not see
 * (polar night, the gaps between two passes, open sea in a land-only mosaic) arrive as solid black and would cover
 * the good picture underneath. Tiles of such layers are fetched through a small protocol that turns near-black
 * pixels clear, with a short ramp so the edge of a gap is soft instead of a hard black fringe.
 */
const PROTOCOL = "fsclear";
/** Brightest colour channel at or below CLEAR is fully clear; from SOLID up the pixel is kept as it is. */
const CLEAR = 5, SOLID = 20;

/** The address MapLibre should load a layer's tiles from. */
export function tilesFor(l: GibsLayer, date: string): string[] {
  const url = tileUrl(l, date);
  return [l.blackIsNoData ? url.replace(/^https:/, `${PROTOCOL}:`) : url];
}

/** Makes near-black pixels clear, in place. Returns false when the tile had none (nothing to redraw). */
export function clearBlack(rgba: Uint8ClampedArray): boolean {
  let changed = false;
  for (let i = 0; i < rgba.length; i += 4) {
    const top = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (top >= SOLID) continue;
    rgba[i + 3] = top <= CLEAR ? 0 : Math.round((255 * (top - CLEAR)) / (SOLID - CLEAR));
    changed = true;
  }
  return changed;
}

type MapLibre = typeof import("maplibre-gl");
let registered = false;

/** Registers the protocol once per page. Safe to call again. */
export function registerTileProtocol(ml: MapLibre) {
  if (registered) return;
  registered = true;
  ml.addProtocol(PROTOCOL, async (params, abort) => {
    const url = params.url.replace(`${PROTOCOL}:`, "https:");
    const res = await fetch(url, { signal: abort.signal });
    // Same error MapLibre raises itself, so a missing tile is handled the usual way (the map keeps what it has).
    if (!res.ok) throw new ml.AJAXError(res.status, res.statusText, url, await res.blob());
    const picture = await createImageBitmap(await res.blob());
    const w = picture.width, h = picture.height;
    const canvas = typeof OffscreenCanvas === "undefined" ? Object.assign(document.createElement("canvas"), { width: w, height: h }) : new OffscreenCanvas(w, h);
    const g = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!g) return { data: picture };
    g.drawImage(picture, 0, 0);
    const pixels = g.getImageData(0, 0, w, h);
    if (!clearBlack(pixels.data)) return { data: picture }; // the common case: a tile with no gaps is passed through untouched
    picture.close();
    g.putImageData(pixels, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
}
