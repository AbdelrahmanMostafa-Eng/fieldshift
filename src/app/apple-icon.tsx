import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS: the sprout from icon.svg on the night-sky colour. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0d0b" }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="21" fill="none" stroke="#d8a63f" strokeWidth="2.4" opacity="0.45" />
          <path d="M32 50V34" fill="none" stroke="#d8a63f" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M32 34c0-7 4.6-11.5 13.5-11.5 0 7.8-4.6 11.5-13.5 11.5z" fill="none" stroke="#d8a63f" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M32 39c0-5.7-4.1-9.6-12.5-9.6 0 6.6 4.1 9.6 12.5 9.6z" fill="none" stroke="#d8a63f" strokeWidth="3.2" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
