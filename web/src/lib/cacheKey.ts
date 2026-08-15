import type { LatLng, TravelMode } from './types'
import { CACHE_COORD_DECIMALS } from './config'
import { normalizeCoord } from './geo'

export interface CommuteCacheKeyInput {
  origin: LatLng
  destination: LatLng
  mode: TravelMode
  arrivalTime: string
  weekdayType: 'weekday' | 'weekend'
  preference: string
  provider: string
}

function coordKey(p: LatLng): string {
  return `${normalizeCoord(p.lat, CACHE_COORD_DECIMALS)},${normalizeCoord(p.lng, CACHE_COORD_DECIMALS)}`
}

/** Buckets an HH:MM time into a 30-minute bucket like "09:00". */
export function timeBucket(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '09:00'
  const bucketMin = m < 30 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${bucketMin}`
}

export function commuteCacheKey(input: CommuteCacheKeyInput): string {
  return [
    coordKey(input.origin),
    coordKey(input.destination),
    input.mode,
    timeBucket(input.arrivalTime),
    input.weekdayType,
    input.preference,
    input.provider,
  ].join('|')
}

export function isochroneCacheKey(
  center: LatLng,
  mode: TravelMode,
  timeLimitMinutes: number,
  arrivalTime: string,
): string {
  return [
    coordKey(center),
    mode,
    String(timeLimitMinutes),
    timeBucket(arrivalTime),
  ].join('|')
}
