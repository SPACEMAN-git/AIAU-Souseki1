import type {
  BatchRouteInput,
  CommuteProvider,
  IsochroneInput,
  IsochroneResult,
  LatLng,
  PlaceCandidate,
  RouteInput,
  RouteLeg,
  RouteResult,
  RouteShape,
  TravelMode,
} from '../lib/types'
import type { Position } from 'geojson'
import { DEMO_STATIONS, DEMO_STATION_EDGES } from '../data/demoStations'
import { shortestPath } from '../lib/dijkstra'
import { circlePolygon, estimateMinutes, estimateRadiusKm, haversineKm } from '../lib/geo'
import {
  DEMO_FARE_BASE_YEN,
  DEMO_FARE_PER_STATION_YEN,
  SPEED_KMH,
} from '../lib/config'
import { DEMO_PLACES } from '../data/demoPlaces'

function stationCoords(ids: string[]): Position[] {
  const byId = new Map(DEMO_STATIONS.map((s) => [s.id, s]))
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is (typeof DEMO_STATIONS)[number] => s != null)
    .map((s) => [s.lng, s.lat] as Position)
}

function nearestStation(p: LatLng) {
  let best = DEMO_STATIONS[0]
  let bestKm = Infinity
  for (const s of DEMO_STATIONS) {
    const km = haversineKm(p, s)
    if (km < bestKm) {
      bestKm = km
      best = s
    }
  }
  return { station: best, walkMinutes: Math.round((bestKm * 1.3 * 60) / SPEED_KMH.walk) }
}

/**
 * Fully offline demo provider. Transit uses Dijkstra over the demo
 * station network with average inter-station minutes; other modes use
 * straight-line estimation with road-correction factors.
 * Every result is flagged isEstimated=true.
 */
export class DemoTransitProvider implements CommuteProvider {
  readonly name = 'demo' as const

  supportsMode(): boolean {
    return true
  }

  async geocodePlace(query: string): Promise<PlaceCandidate[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return DEMO_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q),
    ).slice(0, 8)
  }

  async calculateRoute(input: RouteInput): Promise<RouteResult> {
    const now = new Date().toISOString()
    if (input.mode === 'transit' || input.mode === 'walk_transit') {
      const from = nearestStation(input.origin)
      const to = nearestStation(input.destination)
      const path =
        from.station.id === to.station.id
          ? null
          : shortestPath(
              DEMO_STATIONS,
              DEMO_STATION_EDGES,
              from.station.id,
              to.station.id,
            )
      if (path) {
        const legs: RouteLeg[] = [
          { kind: 'walk', minutes: from.walkMinutes, toName: from.station.name },
          ...path.lines.map((line) => ({
            kind: 'train' as const,
            minutes: Math.round(path.minutes / path.lines.length),
            lineName: line,
          })),
          { kind: 'walk', minutes: to.walkMinutes, fromName: to.station.name },
        ]
        const duration = from.walkMinutes + path.minutes + to.walkMinutes + 4
        return {
          durationMinutes: duration,
          walkingMinutes: from.walkMinutes + to.walkMinutes,
          transferCount: path.transferCount,
          estimatedCostYen:
            DEMO_FARE_BASE_YEN +
            DEMO_FARE_PER_STATION_YEN * Math.max(path.stations.length - 1, 1),
          legs,
          summary: `${from.station.name}駅 → ${path.lines.join(' → ')} → ${to.station.name}駅`,
          provider: 'demo',
          isEstimated: true,
          computedAt: now,
          shape: {
            walk: [
              [
                [input.origin.lng, input.origin.lat],
                [from.station.lng, from.station.lat],
              ],
              [
                [to.station.lng, to.station.lat],
                [input.destination.lng, input.destination.lat],
              ],
            ],
            transit: [stationCoords(path.stations)],
          },
        }
      }
      // Same nearest station or unreachable: walk estimate.
      const walkMin = estimateMinutes(input.origin, input.destination, 'walk')
      return {
        durationMinutes: walkMin,
        walkingMinutes: walkMin,
        transferCount: 0,
        estimatedCostYen: 0,
        legs: [{ kind: 'walk', minutes: walkMin }],
        summary: '徒歩（推定）',
        provider: 'demo',
        isEstimated: true,
        computedAt: now,
        shape: straightShape(input, 'walk'),
      }
    }
    const minutes = estimateMinutes(input.origin, input.destination, input.mode)
    return {
      durationMinutes: minutes,
      walkingMinutes: input.mode === 'walk' ? minutes : 0,
      transferCount: 0,
      estimatedCostYen: null,
      legs: [{ kind: modeLegKind(input.mode), minutes }],
      summary: '直線距離ベースの推定',
      provider: 'demo',
      isEstimated: true,
      computedAt: now,
      shape: straightShape(
        input,
        input.mode === 'walk' ? 'walk' : 'transit',
      ),
    }
  }

  async calculateBatchRoutes(
    input: BatchRouteInput,
  ): Promise<Array<RouteResult & { id: string }>> {
    const results: Array<RouteResult & { id: string }> = []
    for (const origin of input.origins) {
      const r = await this.calculateRoute({
        origin,
        destination: input.destination,
        mode: input.mode,
        arrivalTime: input.arrivalTime,
      })
      results.push({ ...r, id: origin.id })
    }
    return results
  }

  async calculateIsochrone(input: IsochroneInput): Promise<IsochroneResult> {
    const radius = estimateRadiusKm(input.mode, input.timeLimitMinutes)
    return {
      polygon: circlePolygon(input.center, radius),
      provider: 'demo',
      isEstimated: true,
      computedAt: new Date().toISOString(),
    }
  }
}

/** Straight origin/destination line for estimated (non-routed) modes. */
function straightShape(
  input: RouteInput,
  kind: 'walk' | 'transit',
): RouteShape {
  const line: Position[] = [
    [input.origin.lng, input.origin.lat],
    [input.destination.lng, input.destination.lat],
  ]
  return kind === 'walk'
    ? { walk: [line], transit: [] }
    : { walk: [], transit: [line] }
}

function modeLegKind(mode: TravelMode): RouteLeg['kind'] {
  if (mode === 'car') return 'car'
  if (mode === 'bicycle') return 'bicycle'
  return 'walk'
}
