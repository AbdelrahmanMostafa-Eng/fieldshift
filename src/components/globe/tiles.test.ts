import { describe, expect, it } from "vitest";
import { BASE_LAYER, BLUE_MARBLE, OVERLAYS, SHARP_LAYER } from "@/lib/gibs";
import { clearBlack, tilesFor } from "./tiles";

describe("tiles without transparency", () => {
  it("sends only the JPEG layers that mark gaps in black through the clean-up protocol", () => {
    expect(tilesFor(BASE_LAYER, "2026-11-14")[0]).toMatch(/^fsclear:\/\/gibs\.earthdata\.nasa\.gov\/.*\/2026-11-14\//);
    expect(tilesFor(SHARP_LAYER, "2026-11-14")[0]).toMatch(/^fsclear:\/\/.*\/2000-12-01\/GoogleMapsCompatible_Level12\//); // its own fixed year, not the slider's date
    expect(tilesFor(BLUE_MARBLE, "2026-11-14")[0]).toMatch(/^https:\/\//);
    for (const o of OVERLAYS) expect(tilesFor(o, "2026-11-14")[0], o.id).toMatch(/^https:\/\//); // PNG: already transparent where empty
  });

  it("clears black, keeps real colour, and ramps in between", () => {
    const px = new Uint8ClampedArray([
      0, 0, 0, 255,      // no data
      3, 4, 2, 255,      // JPEG noise around no data
      10, 12, 9, 255,    // the soft edge
      4, 14, 36, 255,    // deep clear ocean: dark, but real
      200, 180, 150, 255,
    ]);
    expect(clearBlack(px)).toBe(true);
    expect([px[3], px[7]]).toEqual([0, 0]);
    expect(px[11]).toBeGreaterThan(0);
    expect(px[11]).toBeLessThan(255);
    expect([px[15], px[19]]).toEqual([255, 255]);
    expect(Array.from(px.slice(12, 15))).toEqual([4, 14, 36]); // colours are never touched, only opacity
  });

  it("reports an untouched tile, so it can be passed through as it came", () => {
    expect(clearBlack(new Uint8ClampedArray([40, 60, 90, 255, 255, 255, 255, 255]))).toBe(false);
  });
});
