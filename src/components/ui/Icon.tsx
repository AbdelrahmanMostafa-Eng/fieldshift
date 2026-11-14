/**
 * The app's icon set: hand-drawn, one family, one stroke weight (1.5 on a 20 px grid, round joins).
 * No icon dependency. Icons are decorative: the control that holds one carries the label.
 */
const PATHS = {
  search: <><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2 17 17" /></>,
  locate: <><circle cx="10" cy="10" r="5.5" /><circle cx="10" cy="10" r="1.4" /><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" /></>,
  layers: <><path d="m10 2.8 7.2 3.7L10 10.2 2.8 6.5z" /><path d="m2.8 10 7.2 3.7 7.2-3.7" /><path d="m2.8 13.5 7.2 3.7 7.2-3.7" /></>,
  globe: <><circle cx="10" cy="10" r="7.5" /><ellipse cx="10" cy="10" rx="3.2" ry="7.5" /><path d="M2.5 10h15" /></>,
  map: <><path d="m2.5 5 5-2 5 2 5-2v12l-5 2-5-2-5 2z" /><path d="M7.5 3v12M12.5 5v12" /></>,
  sun: <><circle cx="10" cy="10" r="3.2" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" /></>,
  moon: <path d="M16.6 11.6A7 7 0 1 1 8.4 3.4a5.6 5.6 0 0 0 8.2 8.2z" />,
  monitor: <><rect x="2.5" y="3.5" width="15" height="10" rx="1.5" /><path d="M7 17h6M10 13.5V17" /></>,
  chevron: <path d="m5 7.5 5 5 5-5" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  language: <><path d="M2.5 5h8M6.5 3v2M9 5c-.6 3.1-2.7 5.4-6 6.8M4.6 8.2c.9 1.7 2.4 3 4.3 3.8" /><path d="m10.8 17 3.4-8 3.4 8M12 14.3h4.4" /></>,
  send: <path d="M10 16V4M5 9l5-5 5 5" />,
  sprout: <><path d="M10 18v-7" /><path d="M10 11c0-3 2-5 6-5 0 3.4-2 5-6 5z" /><path d="M10 13.2c0-2.5-1.8-4.2-5.5-4.2 0 2.9 1.8 4.2 5.5 4.2z" /></>,
  alert: <><path d="M10 3.2 17.8 16.5H2.2z" /><path d="M10 8.2v4M10 14.4v.2" /></>,
  info: <><circle cx="10" cy="10" r="7.5" /><path d="M10 9.2v4.6M10 6.3v.2" /></>,
  sliders: <><path d="M3 6h7M14.5 6H17M3 14h2.5M10 14h7" /><circle cx="12.2" cy="6" r="2.2" /><circle cx="7.8" cy="14" r="2.2" /></>,
  pin: <><path d="M10 17.8s5.8-5 5.8-9.6a5.8 5.8 0 1 0-11.6 0c0 4.600 5.8 9.600 5.8 9.600z" /><circle cx="10" cy="8.200" r="2" /></>,
  arrow: <path d="M4 10h12M11 5l5 5-5 5" />,
  spinner: <path d="M10 2.500a7.500 7.500 0 1 1-7.500 7.500" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  // `arrow` points along the reading direction, so it flips on right-to-left pages.
  const flip = name === "arrow" ? " rtl:-scale-x-100" : "";
  const spin = name === "spinner" ? " fs-spin" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={`shrink-0${flip}${spin} ${className}`}>
      {PATHS[name]}
    </svg>
  );
}
