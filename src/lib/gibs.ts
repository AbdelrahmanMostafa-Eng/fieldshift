/**
 * NASA GIBS layers. Every id, format, tile matrix set and date range below was read from
 * https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml on 2026-11-14.
 * `confirmed: true` means exactly that; never set it for a layer you have not looked up.
 */
export interface GibsLegend {
  /** Evenly sampled colours from the GIBS colour map, lowest value first. */
  stops: string[];
  min: number;
  max: number;
  /** "K" = kelvin, "index" = unitless index. */
  unit: "K" | "index";
  /** The GIBS colour map the stops and the range were read from. */
  source: string;
}

export interface GibsLayer {
  id: string;
  /** Short key used for translations (`layers.<key>`). */
  key: "trueColour" | "blueMarble" | "lst" | "ndvi";
  label: string;
  tms: string; // WMTS tile matrix set
  ext: "jpg" | "jpeg" | "png";
  maxZoom: number;
  opacity: number;
  /** daily = one image per day; rolling8 = 8-day composite that is re-issued every day; static = no date at all. */
  cadence: "daily" | "rolling8" | "static";
  confirmed: boolean;
  legend?: GibsLegend;
}

/** Daily true colour. The SNPP version of this layer stopped on 2026-11-02, so NOAA-20 is used instead. */
export const BASE_LAYER: GibsLayer = {
  id: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", key: "trueColour",
  label: "True colour (VIIRS, NOAA-20)", tms: "GoogleMapsCompatible_Level9", ext: "jpg", maxZoom: 9, opacity: 1, cadence: "daily", confirmed: true,
};

/** Cloud-free composite for the wide view. Static: its tile address has no date. */
export const BLUE_MARBLE: GibsLayer = {
  id: "BlueMarble_ShadedRelief_Bathymetry", key: "blueMarble",
  label: "Blue Marble (shaded relief and bathymetry)", tms: "GoogleMapsCompatible_Level8", ext: "jpeg", maxZoom: 8, opacity: 1, cadence: "static", confirmed: true,
};

export const OVERLAYS: GibsLayer[] = [
  {
    id: "MODIS_Terra_Land_Surface_Temp_Day", key: "lst", label: "Land surface temperature (day)",
    tms: "GoogleMapsCompatible_Level7", ext: "png", maxZoom: 7, opacity: 0.7, cadence: "daily", confirmed: true,
    legend: {
      stops: ["#c900ff", "#4d00ff", "#0047ff", "#00e6ff", "#66ff12", "#dbff00", "#ffc100", "#ff5e00", "#ff0100"],
      min: 200, max: 350, unit: "K",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml",
    },
  },
  {
    id: "MODIS_Terra_NDVI_8Day", key: "ndvi", label: "Vegetation greenness (NDVI, 8-day)",
    tms: "GoogleMapsCompatible_Level9", ext: "png", maxZoom: 9, opacity: 0.75, cadence: "rolling8", confirmed: true,
    legend: {
      stops: ["#e1e1e1", "#e1d2c5", "#b9ab9c", "#a58469", "#a0c031", "#56a100", "#2e8000", "#056401", "#001801"],
      min: -0.2, max: 1, unit: "index",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml",
    },
  },
];

export function tileUrl(l: GibsLayer, date: string): string {
  // WMTS REST order is {TileMatrix}/{TileRow}/{TileCol} = {z}/{y}/{x}. Static layers have no date segment.
  const time = l.cadence === "static" ? "" : `${date}/`;
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${time}${l.tms}/{z}/{y}/{x}.${l.ext}`;
}

/** UTC date N days back. Today's tiles are often partly empty, so default to yesterday. */
export function gibsDate(daysBack = 1, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
  return d.toISOString().slice(0, 10);
}

/** The date slider covers yesterday (1) back to this many days ago. */
export const DATE_RANGE_DAYS = 30;

/** Kelvin to whole degrees Celsius, for showing the temperature legend in a familiar unit. */
export const kelvinToCelsius = (k: number): number => Math.round(k - 273.15);

/** CSS gradient for a legend bar. `toward` is a CSS direction such as "to right". */
export function legendGradient(legend: GibsLegend, toward = "to right"): string {
  return `linear-gradient(${toward}, ${legend.stops.join(", ")})`;
}

/** Paste the exact acknowledgment sentence from NASA's GIBS acknowledgment page next to this. */
export const GIBS_CREDIT = "Imagery: NASA GIBS / EOSDIS";
export const NASA_DISCLAIMER =
  "NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. Data use terms of each source apply.";

/** Elevation tiles (Terrarium encoding) from the public AWS Open Data bucket. Key-free. */
export const TERRAIN = {
  tiles: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  maxZoom: 12,
  credit: "Terrain: Mapzen terrain tiles, hosted by AWS Open Data",
  source: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
} as const;

export const PLACES_CREDIT = "Place names: Natural Earth (public domain)";
