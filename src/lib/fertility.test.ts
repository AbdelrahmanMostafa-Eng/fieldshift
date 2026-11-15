import { describe, expect, it } from "vitest";
import { CROPS } from "@/data/crops";
import { fertilityNotes } from "./fertility";

const notes = (id: string) => fertilityNotes(CROPS.find((c) => c.id === id)!);

describe("fertility notes (no doses)", () => {
  it("always starts with a soil test and ends with the no-dose line", () => {
    for (const c of CROPS) {
      const n = fertilityNotes(c);
      expect(n[0], c.id).toBe("soilTest");
      expect(n[n.length - 1], c.id).toBe("noDose");
    }
  });
  it("tells legumes they make their own nitrogen, and never pushes nitrogen on them", () => {
    for (const c of CROPS.filter((x) => x.nFixing)) {
      expect(fertilityNotes(c), c.id).toContain("legume");
      expect(fertilityNotes(c), c.id).not.toContain("nitrogen");
    }
  });
  it("matches crop types to the right nutrient", () => {
    expect(notes("wheat")).toContain("nitrogen");
    expect(notes("ryegrass")).toContain("nitrogen");
    expect(notes("potato")).toContain("potassium");
    expect(notes("canola")).toContain("sulfur");
    expect(notes("cabbage")).toContain("sulfur");
    expect(notes("tomato")).toContain("calcium");
    expect(notes("onion")).toEqual(["soilTest", "organic", "fourR", "noDose"]);
  });
});
