import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // Off on purpose: with the build cache warm, two builds on 15 Nov 2026 shipped a stale globals.css
    // (new rules missing) until the cache was cleared. Vercel restores .next/cache between deploys, so a
    // cold build every time is the safe choice. Costs a few seconds per build.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    // Pin the project root. Without this, a lockfile in a parent folder makes Next pick the wrong root.
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default createNextIntlPlugin()(nextConfig);
