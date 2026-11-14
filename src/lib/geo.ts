/** Small map-maths helpers shared by the globe and its no-WebGL fallback. Pure, unit-tested. */

/** Wrap any longitude into -180..180 (a spinning globe hands back values like 395). */
export function wrapLon(lon: number): number {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  return w === -180 && lon > 0 ? 180 : w;
}

export const clampLat = (lat: number): number => Math.max(-85, Math.min(85, lat));

/** Web Mercator: fraction of the map height (0 = top, 1 = bottom) to latitude in degrees. */
export function mercatorYToLat(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/** Web Mercator: latitude in degrees to a fraction of the map height (0 = top, 1 = bottom). */
export function latToMercatorY(lat: number): number {
  const s = Math.sin((clampLat(lat) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/**
 * Zoom at which MapLibre's globe is `diameterPx` wide on screen.
 * MapLibre draws the sphere with radius worldSize / (2π cos φ), worldSize = 512 · 2^zoom, φ = centre latitude.
 */
export function zoomForGlobeDiameter(diameterPx: number, centerLat: number): number {
  const cos = Math.cos((clampLat(centerLat) * Math.PI) / 180);
  return Math.log2((Math.max(1, diameterPx) * Math.PI * cos) / 512);
}

/** Ease-out cubic, used for the intro dolly-in. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
