// MapLibre GL JS 6 is ESM-only and loads its worker from a separate file next to its own module.
// Turbopack does not serve that file, so copy it into public/ and point MapLibre at it with
// setWorkerUrl() (see src/components/globe/Globe.tsx). Runs before `next dev` and `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const to = join(root, "public", "maplibre-gl-worker.mjs");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("maplibre worker copied to public/maplibre-gl-worker.mjs");
