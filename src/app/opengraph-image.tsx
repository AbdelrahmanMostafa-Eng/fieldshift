import { ImageResponse } from "next/og";

export const alt = "FieldShift: plan the next three seasons with NASA's view of your land";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a link to FieldShift is shared. Drawn in code: night sky, a planet limb, the wordmark. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(160deg, #0d1828 0%, #03050a 70%)", color: "#f1ece0", fontFamily: "serif" }}>
        {/* the limb of a planet, lower right */}
        <div style={{ position: "absolute", right: -260, bottom: -420, width: 900, height: 900, borderRadius: 900, background: "radial-gradient(circle at 35% 30%, #4f7f97 0%, #1d3a4a 45%, #0b1620 75%)", boxShadow: "0 0 80px 10px rgba(127,176,198,0.35)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", width: 760 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#e9c26a", fontFamily: "monospace" }}>FIELDSHIFT · SPACE APPS 2026</div>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1, marginTop: 28 }}>Plan the next three seasons with NASA&apos;s view of your land</div>
          <div style={{ display: "flex", fontSize: 28, marginTop: 28, color: "rgba(241,236,224,0.75)", fontFamily: "sans-serif" }}>Crop rotations for soil, water and income. Free, no sign-up, in 20 languages.</div>
        </div>
      </div>
    ),
    size,
  );
}
