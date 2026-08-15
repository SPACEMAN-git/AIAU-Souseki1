/**
 * NAVITIME transit routing via the RapidAPI gateway
 * (navitime-route-totalnavi). The key is read from function secrets and
 * never reaches the browser.
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface RouteLeg {
  kind: 'walk' | 'train' | 'bus' | 'car' | 'bicycle' | 'wait' | 'transfer'
  minutes: number
  lineName?: string
  fromName?: string
  toName?: string
}

export type Coordinates = [number, number][]

/** Route line split by travel kind so the map can style each part. */
export interface RouteShape {
  walk: Coordinates[]
  transit: Coordinates[]
}

export interface RouteResult {
  durationMinutes: number
  walkingMinutes: number
  transferCount: number
  estimatedCostYen: number | null
  legs: RouteLeg[]
  summary: string
  provider: string
  isEstimated: boolean
  computedAt: string
  shape?: RouteShape
}

const DEFAULT_HOST = 'navitime-route-totalnavi.p.rapidapi.com'

export function navitimeHost(): string {
  return Deno.env.get('NAVITIME_RAPIDAPI_HOST') ?? DEFAULT_HOST
}

export function navitimeKey(): string | undefined {
  return (
    Deno.env.get('NAVITIME_RAPIDAPI_KEY') ??
    Deno.env.get('RAPIDAPI_KEY') ??
    Deno.env.get('NAVITIME_API_KEY') ??
    undefined
  )
}

/** Max NAVITIME calls a single batch request may spend (quota guard). */
export function navitimeMaxCalls(): number {
  const raw = Number(Deno.env.get('NAVITIME_MAX_CALLS_PER_REQUEST'))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100
}

/**
 * Builds the NAVITIME `goal_time` value: the next weekday at the given
 * HH:MM in JST (+09:00), so results reflect a normal commuting day.
 */
export function nextWeekdayArrival(arrivalTime?: string): string {
  const [hh, mm] = (arrivalTime ?? '09:00').split(':').map(Number)
  const h = Number.isFinite(hh) ? hh : 9
  const m = Number.isFinite(mm) ? mm : 0
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000)
  const d = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()),
  )
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(h)}:${p(m)}:00`
}

interface NavitimeSection {
  type: string
  name?: string
  time?: number
  move?: string
  line_name?: string
  transport?: { name?: string }
}

interface NavitimeShapes {
  features?: Array<{
    geometry?: { type?: string; coordinates?: unknown }
    properties?: { ways?: string }
  }>
}

interface NavitimeItem {
  summary?: {
    move?: {
      time?: number
      transit_count?: number
      fare?: Record<string, number>
      reference_fare?: {
        lowest_total_ic?: number
        lowest_total_ticket?: number
      }
    }
  }
  sections?: NavitimeSection[]
  shapes?: NavitimeShapes
}

/** `start` / `goal` are NAVITIME's own markers, not place names. */
function pointName(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === 'start') return '出発地'
  if (raw === 'goal') return '勤務地'
  return raw
}

function shapeOf(shapes: NavitimeShapes | undefined): RouteShape | undefined {
  const walk: Coordinates[] = []
  const transit: Coordinates[] = []
  for (const f of shapes?.features ?? []) {
    if (f.geometry?.type !== 'LineString') continue
    const raw = f.geometry.coordinates
    if (!Array.isArray(raw)) continue
    const line: Coordinates = []
    for (const c of raw) {
      if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') {
        continue
      }
      line.push([round5(c[0]), round5(c[1])])
    }
    if (line.length < 2) continue
    if (f.properties?.ways === 'walk') walk.push(line)
    else transit.push(line)
  }
  if (!walk.length && !transit.length) return undefined
  return { walk, transit }
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5
}

function legKind(move: string | undefined): RouteLeg['kind'] {
  if (!move) return 'walk'
  if (move === 'walk') return 'walk'
  if (move.includes('bus')) return 'bus'
  if (move === 'car') return 'car'
  if (move === 'bicycle') return 'bicycle'
  return 'train'
}

export function mapNavitimeRoute(item: NavitimeItem): RouteResult | null {
  const move = item.summary?.move
  const total = move?.time
  if (typeof total !== 'number') return null

  const sections = item.sections ?? []
  const legs: RouteLeg[] = []
  let walkingMinutes = 0
  const stations: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    if (s.type === 'point') {
      const name = s.name
      if (name && name !== 'start' && name !== 'goal') stations.push(name)
      continue
    }
    if (s.type !== 'move') continue
    const minutes = typeof s.time === 'number' ? s.time : 0
    const kind = legKind(s.move)
    if (kind === 'walk') walkingMinutes += minutes
    legs.push({
      kind,
      minutes,
      lineName: s.transport?.name ?? s.line_name,
      fromName: pointName(sections[i - 1]?.name),
      toName: pointName(sections[i + 1]?.name),
    })
  }

  const fare =
    move?.reference_fare?.lowest_total_ic ??
    move?.reference_fare?.lowest_total_ticket ??
    move?.fare?.unit_0 ??
    null

  const transferCount = move?.transit_count ?? 0
  const via = stations.length
    ? `${stations[0]} → ${stations[stations.length - 1]}`
    : 'ドアツードア'

  return {
    durationMinutes: Math.round(total),
    walkingMinutes,
    transferCount,
    estimatedCostYen: fare == null ? null : Math.round(fare),
    legs,
    summary: `${via}（乗換${transferCount}回・NAVITIME）`,
    provider: 'navitime',
    isEstimated: false,
    computedAt: new Date().toISOString(),
    shape: shapeOf(item.shapes),
  }
}

/** Calls NAVITIME route_transit for one origin/destination pair. */
export async function navitimeTransitRoute(
  origin: LatLng,
  destination: LatLng,
  arrivalTime?: string,
): Promise<RouteResult | null> {
  const key = navitimeKey()
  if (!key) return null
  const host = navitimeHost()
  const params = new URLSearchParams({
    start: `${origin.lat},${origin.lng}`,
    goal: `${destination.lat},${destination.lng}`,
    goal_time: nextWeekdayArrival(arrivalTime),
    shape: 'true',
  })
  const res = await fetch(`https://${host}/route_transit?${params}`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { items?: NavitimeItem[] }
  const item = data.items?.[0]
  return item ? mapNavitimeRoute(item) : null
}
