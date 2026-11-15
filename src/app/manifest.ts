import type { MetadataRoute } from "next";

/** Lets phones add FieldShift to the home screen with its own name, colours and icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FieldShift: crop rotations with NASA data",
    short_name: "FieldShift",
    description: "A free decision aid for farmers: compare crop rotations of one to five seasons for soil, water and income with NASA Earth observations.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0d0b",
    theme_color: "#0e0d0b",
    categories: ["education", "utilities", "weather"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
