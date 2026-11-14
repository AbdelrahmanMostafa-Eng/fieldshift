import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the project root. Without this, a lockfile in a parent folder makes Next pick the wrong root.
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default createNextIntlPlugin()(nextConfig);
