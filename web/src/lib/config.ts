import type { TravelMode } from './types'

/** Speed and correction parameters used by estimation fallbacks. */
export const SPEED_KMH: Record<TravelMode, number> = {
  walk: 4.8,
  bicycle: 15,
  car: 30,
  transit: 28,
  walk_transit: 25,
}

/** Straight-line distance -> road distance correction factors. */
export const ROAD_FACTOR: Record<TravelMode, number> = {
  walk: 1.3,
  bicycle: 1.25,
  car: 1.4,
  transit: 1.35,
  walk_transit: 1.35,
}

/** Fixed overhead minutes (waiting, access) per mode for estimation. */
export const MODE_OVERHEAD_MIN: Record<TravelMode, number> = {
  walk: 0,
  bicycle: 2,
  car: 5,
  transit: 8,
  walk_transit: 8,
}

export const DEMO_TRANSFER_MINUTES = 5
export const DEMO_FARE_BASE_YEN = 150
export const DEMO_FARE_PER_STATION_YEN = 20

export const CACHE_COORD_DECIMALS = 4

export const CACHE_TTL_DAYS = {
  geocode: 30,
  staticRoute: 14,
  transitRoute: 3,
  isochrone: 3,
} as const

export const MAX_COMMUTE_OPTIONS = [15, 20, 30, 40, 45, 60, 75, 90]

/** Upper bound for a hand-typed commute limit (minutes). */
export const MAX_COMMUTE_LIMIT = 180

export const DEFAULT_ARRIVAL_TIME = '09:00'

export const GSI_TILE_URL =
  'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
export const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>'

export const DEMO_MODE =
  (import.meta.env?.VITE_DEMO_MODE ?? 'true') !== 'false'

export const SUPABASE_URL: string = import.meta.env?.VITE_SUPABASE_URL ?? ''
export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const SUPABASE_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
)
