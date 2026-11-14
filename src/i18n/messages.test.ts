import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";

const dir = join(process.cwd(), "messages");
const load = (l: string) => JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8")) as Record<string, unknown>;
const keys = (o: unknown, p = ""): string[] =>
  o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const flat = (o: unknown, p = ""): [string, string][] =>
  o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [[p, String(o)]];

const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));

describe("translations", () => {
  it("only ships files for supported locales", () => {
    for (const f of files) expect(LOCALES as readonly string[]).toContain(f);
  });
  it.each(files.filter((f) => f !== "en"))("%s has exactly the same keys and placeholders as en", (l) => {
    expect(keys(load(l)).sort()).toEqual(keys(load("en")).sort());
    const en = new Map(flat(load("en")));
    for (const [k, v] of flat(load(l))) expect(vars(v), `${l}:${k}`).toBe(vars(en.get(k) ?? ""));
  });
});
