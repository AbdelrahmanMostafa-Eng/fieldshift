/**
 * NASA GIBS layers. Every id, format, tile matrix set and date range below was read from
 * https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml on 2026-11-14 (first four)
 * and 2026-11-15 (the five weather and soil layers, with their colour maps from gibs.earthdata.nasa.gov/colormaps/v1.3/).
 * `confirmed: true` means exactly that; never set it for a layer you have not looked up.
 */
export interface GibsLegend {
  /** Evenly sampled colours from the GIBS colour map, lowest value first. */
  stops: string[];
  min: number;
  max: number;
  /** "K" = kelvin (shown in °C), "index" = unitless index; the rest are shown as they are. */
  unit: "K" | "index" | "m/s" | "%" | "mm/h" | "m³/m³";
  /** The GIBS colour map the stops and the range were read from. */
  source: string;
  /** "log" when the colour steps are evenly spaced in the logarithm of the value (rain rate). Default: linear. */
  scale?: "linear" | "log";
  /** A second colour ramp over the same range, when the colour map has one (snow, next to rain). */
  second?: { key: "snow"; stops: string[] };
}

/** The value halfway along a legend bar: the plain middle, or the geometric middle on a logarithmic scale. */
export const legendMid = (l: GibsLegend): number => (l.scale === "log" ? Math.sqrt(l.min * l.max) : (l.min + l.max) / 2);

export interface GibsLayer {
  id: string;
  /** Short key used for translations (`layers.<key>`). */
  key: "trueColour" | "blueMarble" | "landsat" | "lst" | "ndvi" | "airTemp" | "wind" | "humidity" | "rain" | "soilWater";
  label: string;
  tms: string; // WMTS tile matrix set
  ext: "jpg" | "jpeg" | "png";
  maxZoom: number;
  opacity: number;
  /**
   * daily = one image per day; rolling8 = 8-day composite re-issued every day; monthly = one map per month, always the
   * newest month published (the tile address uses GIBS's "default" time); static = no date at all.
   */
  cadence: "daily" | "rolling8" | "monthly" | "static" | "fixed";
  /** For cadence "fixed": the one time the layer is read at (a composite of a past year). */
  time?: string;
  /**
   * True for JPEG imagery, which has no transparency: places with no data (polar night, gaps between satellite passes,
   * open sea in a land-only mosaic) come as pure black. The globe turns those pixels clear (globe/tiles.ts).
   */
  blackIsNoData?: boolean;
  /** Days a daily layer runs behind. Dates newer than that use the newest image GIBS has ("default"). */
  lagDays?: number;
  confirmed: boolean;
  legend?: GibsLegend;
}

/** Daily true colour. The SNPP version of this layer stopped on 2026-11-02, so NOAA-20 is used instead. */
export const BASE_LAYER: GibsLayer = {
  id: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", key: "trueColour",
  label: "True colour (VIIRS, NOAA-20)", tms: "GoogleMapsCompatible_Level9", ext: "jpg", maxZoom: 9, opacity: 1, cadence: "daily", blackIsNoData: true, confirmed: true,
};

/**
 * Sharp imagery for the closest view: a cloud-free Landsat mosaic at 30 m, where single fields can be told apart
 * (the daily image above is 250 m). It is a composite of the years around 2000, so it is labelled as such wherever it shows.
 * Read from the same capabilities file on 2026-11-15: Level12 tile set, JPEG, time values 1998-12-01 to 2000-12-01, yearly.
 */
export const SHARP_LAYER: GibsLayer = {
  id: "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual", key: "landsat",
  label: "Landsat 30 m composite (WELD, around 2000)", tms: "GoogleMapsCompatible_Level12", ext: "jpg", maxZoom: 12, opacity: 1,
  cadence: "fixed", time: "2000-12-01", blackIsNoData: true, confirmed: true,
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
      // The colour map starts at 0: negative values (water, snow, cloud) are not drawn at all.
      stops: ["#f1ecec", "#e1d2c6", "#b4a596", "#a18063", "#96ba20", "#56a101", "#2e8000", "#006400", "#001801"],
      min: 0, max: 1, unit: "index",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml",
    },
  },
  {
    id: "MERRA2_2m_Air_Temperature_Monthly", key: "airTemp", label: "Air temperature (2 m, monthly, MERRA-2)",
    tms: "GoogleMapsCompatible_Level6", ext: "png", maxZoom: 6, opacity: 0.7, cadence: "monthly", confirmed: true,
    legend: {
      stops: ["#5e4fa2", "#66c2a5", "#abdda4", "#e7f599", "#fefdbc", "#fddb87", "#fba55c", "#ef6644", "#9e0142"],
      min: 220, max: 310, unit: "K",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml",
    },
  },
  {
    id: "IMERG_Precipitation_Rate", key: "rain", label: "Rain rate (daily, IMERG)",
    tms: "GoogleMapsCompatible_Level6", ext: "png", maxZoom: 6, opacity: 0.75, cadence: "daily", lagDays: 2, confirmed: true,
    legend: {
      stops: ["#00764e", "#009c14", "#45c000", "#cfe700", "#ffa00c", "#ff4233", "#da0000", "#8a0000", "#330000"],
      min: 0.1, max: 53, unit: "mm/h", scale: "log",
      // The same colour map draws snowfall in blues and purples over the same range.
      second: { key: "snow", stops: ["#b1faee", "#86e0ee", "#66abdc", "#4d70c5", "#3e40d4", "#632ee5", "#790ac7", "#720683", "#3a0330"] },
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml",
    },
  },
  {
    id: "AIRS_L3_Surface_Relative_Humidity_Monthly_Day", key: "humidity", label: "Relative humidity at the surface (monthly, AIRS)",
    tms: "GoogleMapsCompatible_Level6", ext: "png", maxZoom: 6, opacity: 0.7, cadence: "monthly", confirmed: true,
    legend: {
      stops: ["#b77730", "#e4ab6b", "#f3e0be", "#e9f8df", "#ccfbe5", "#9fe9db", "#64ccd6", "#2295ae", "#002360"],
      min: 0, max: 100, unit: "%",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/AIRS_Surface_Relative_Humidity_Monthly_Day.xml",
    },
  },
  {
    id: "MERRA2_Surface_Wind_Speed_Monthly", key: "wind", label: "Surface wind speed (monthly, MERRA-2)",
    tms: "GoogleMapsCompatible_Level6", ext: "png", maxZoom: 6, opacity: 0.7, cadence: "monthly", confirmed: true,
    legend: {
      stops: ["#5e4fa2", "#66c2a5", "#abdda4", "#e6f598", "#ffffbf", "#fddd88", "#fcaa5f", "#f26a43", "#9e0142"],
      min: 2, max: 18, unit: "m/s",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_Surface_Wind_Speed_Monthly.xml",
    },
  },
  {
    id: "MERRA2_Soil_Water_Root_Zone_Monthly", key: "soilWater", label: "Root-zone soil water (monthly, MERRA-2)",
    tms: "GoogleMapsCompatible_Level6", ext: "png", maxZoom: 6, opacity: 0.75, cadence: "monthly", confirmed: true,
    legend: {
      stops: ["#ffffe5", "#e1f3a8", "#c4e799", "#a0d789", "#79c679", "#4eb163", "#31964f", "#197c3f", "#004529"],
      min: 0, max: 0.45, unit: "m³/m³",
      source: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_Soil_Water_Root_Zone_Monthly.xml",
    },
  },
];

/**
 * The time segment for a layer's tile address. Monthly layers, and dates a lagging daily layer has not reached yet,
 * use GIBS's "default" time, which serves the newest image (checked live: a date past the newest one answers 404).
 */
export function timeFor(l: GibsLayer, date: string, now: Date = new Date()): string {
  if (l.cadence === "fixed") return l.time ?? "default";
  if (l.cadence === "monthly") return "default";
  if (l.lagDays && date > gibsDate(l.lagDays, now)) return "default";
  return date;
}

export function tileUrl(l: GibsLayer, date: string, now: Date = new Date()): string {
  // WMTS REST order is {TileMatrix}/{TileRow}/{TileCol} = {z}/{y}/{x}. Static layers have no date segment.
  const time = l.cadence === "static" ? "" : `${timeFor(l, date, now)}/`;
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
