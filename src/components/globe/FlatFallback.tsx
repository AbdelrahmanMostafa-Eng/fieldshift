"use client";
import { BLUE_MARBLE, tileUrl } from "@/lib/gibs";
import { latToMercatorY, mercatorYToLat } from "@/lib/geo";

const Z = 2, N = 2 ** Z; // 4 x 4 Blue Marble tiles = the whole world in Web Mercator
const TILE = tileUrl(BLUE_MARBLE, "");

export interface FlatFallbackProps {
  marker: { lat: number; lon: number } | null;
  message: string;
  label: string;
  /** Space covered by other UI, in px, so the map sits in what is left. */
  inset: { top: number; bottom: number; start: number; end: number };
  onPick?: (lat: number, lon: number) => void;
}

/**
 * Shown when the device cannot run WebGL 2 or the 3D map fails to start.
 * Plain images, no WebGL: a flat world the user can still tap to choose a place.
 */
export function FlatFallback({ marker, message, label, inset, onPick }: FlatFallbackProps) {
  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) return; // keyboard "click" has no position; the place search covers keyboard users
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    onPick?.(mercatorYToLat(fy), fx * 360 - 180);
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 py-4 text-center"
      style={{ paddingTop: inset.top + 16, paddingBottom: inset.bottom + 16, paddingInlineStart: inset.start + 16, paddingInlineEnd: inset.end + 16 }}>
      {/* Once a place is chosen the hint has done its job; the map gets the room instead. */}
      {!marker && <p role="status" className="max-w-md rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-[#f1ece0]">{message}</p>}
      {/* The map stays square (the tiles are square) and takes the smaller of the free width and height. */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/15" style={{ width: "min(100cqw, 100cqh, 34rem)" }}>
        {/* dir=ltr: tile columns run west to east whatever the page language is */}
        <button type="button" dir="ltr" aria-label={label} onClick={click} className="grid h-full w-full cursor-crosshair grid-cols-4 bg-[#0a1622]">
          {Array.from({ length: N * N }, (_, i) => {
            const x = i % N, y = Math.floor(i / N);
            return (
              // eslint-disable-next-line @next/next/no-img-element -- remote map tiles, not content images
              <img key={i} alt="" draggable={false} loading="lazy" className="h-[calc(100%+1px)] w-[calc(100%+1px)] max-w-none select-none" /* 1px overlap hides hairline seams between tiles */
                src={TILE.replace("{z}", String(Z)).replace("{y}", String(y)).replace("{x}", String(x))} />
            );
          })}
        </button>
        {marker && (
          <span className="fs-pin-flat" style={{ left: `${((marker.lon + 180) / 360) * 100}%`, top: `${latToMercatorY(marker.lat) * 100}%` }}>
            <span className="fs-pin"><span className="fs-pin-ring" /><span className="fs-pin-dot" /></span>
          </span>
        )}
      </div>
      </div>
    </div>
  );
}
