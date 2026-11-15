import { describe, expect, it } from "vitest";
import { SUN, sunLightPosition } from "./optics";

describe("sun direction", () => {
  it("is a unit vector from the upper left, in front of the globe", () => {
    expect(Math.hypot(...SUN)).toBeCloseTo(1, 6);
    expect(SUN[0]).toBeLessThan(0);    // left
    expect(SUN[1]).toBeGreaterThan(0); // up
    expect(SUN[2]).toBeGreaterThan(0); // towards the viewer, so the side being looked at is lit
  });

  it("gives MapLibre a light position that points the opposite way (MapLibre negates it again)", () => {
    const [, azimuth, polar] = sunLightPosition();
    expect(azimuth).toBeGreaterThanOrEqual(0);
    expect(azimuth).toBeLessThan(360);
    expect(polar).toBeGreaterThanOrEqual(0);
    expect(polar).toBeLessThanOrEqual(180);
    // MapLibre's own conversion (sphericalToCartesian): azimuth is measured from +90 degrees.
    const az = ((azimuth + 90) * Math.PI) / 180, po = (polar * Math.PI) / 180;
    const v = [Math.cos(az) * Math.sin(po), Math.sin(az) * Math.sin(po), Math.cos(po)];
    v.forEach((c, i) => expect(-c).toBeCloseTo(SUN[i], 6));
  });
});
