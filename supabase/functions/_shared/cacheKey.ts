/**
 * Server-side mirror of web/src/lib/cacheKey.ts so edge functions can
 * derive commute_cache keys when the client does not send one.
 */
const COORD_DECIMALS = 4

function coord(n: number): string {
  return n.toFixed(COORD_DECIMALS)
}

export function timeBucket(hhmm: string): string {
  const [h, m] = (hhmm || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '09:00'
  return `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`
}

export function commuteCacheKey(input: {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  mode: string
  arrivalTime?: string
  provider?: string
}): string {
  return [
    `${coord(input.origin.lat)},${coord(input.origin.lng)}`,
    `${coord(input.destination.lat)},${coord(input.destination.lng)}`,
    input.mode,
    timeBucket(input.arrivalTime ?? '09:00'),
    'weekday',
    'time',
    input.provider ?? 'navitime',
  ].join('|')
}
