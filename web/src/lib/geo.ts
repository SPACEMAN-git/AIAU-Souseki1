import type { Polygon } from 'geojson'
import type { LatLng, TravelMode } from './types'
import { MODE_OVERHEAD_MIN, ROAD_FACTOR, SPEED_KMH } from './config'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Estimated travel minutes from straight-line distance with road factor. */
export function estimateMinutes(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
): number {
  const km = haversineKm(origin, destination) * ROAD_FACTOR[mode]
  return Math.round((km / SPEED_KMH[mode]) * 60 + MODE_OVERHEAD_MIN[mode])
}

/** Max plausible search radius (km) for a mode and time budget. */
export function estimateRadiusKm(mode: TravelMode, minutes: number): number {
  const usable = Math.max(minutes - MODE_OVERHEAD_MIN[mode], 1)
  return (SPEED_KMH[mode] * usable) / 60 / Math.min(ROAD_FACTOR[mode], 1.2)
}

/** Approximate circular polygon around a center, used as pre-filter range. */
export function circlePolygon(
  center: LatLng,
  radiusKm: number,
  steps = 48,
): Polygon {
  const coords: [number, number][] = []
  const latRad = (center.lat * Math.PI) / 180
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    const dLat = (radiusKm / 111.32) * Math.sin(theta)
    const dLng = (radiusKm / (111.32 * Math.cos(latRad))) * Math.cos(theta)
    coords.push([center.lng + dLng, center.lat + dLat])
  }
  return { type: 'Polygon', coordinates: [coords] }
}

export function normalizeCoord(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}
