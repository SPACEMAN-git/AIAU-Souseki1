import type {
  BatchRouteInput,
  CommuteProvider,
  IsochroneInput,
  IsochroneResult,
  PlaceCandidate,
  RouteInput,
  RouteResult,
  TravelMode,
} from '../lib/types'
import { commuteCacheKey, isochroneCacheKey } from '../lib/cacheKey'
import { DEFAULT_ARRIVAL_TIME } from '../lib/config'

export interface CacheStats {
  hits: number
  misses: number
}

/**
 * In-memory client-side cache wrapper around any CommuteProvider.
 * (The server-side commute_cache table caches across users; this layer
 * avoids re-calling edge functions within one session.)
 */
export class CachedCommuteProvider implements CommuteProvider {
  readonly name
  private readonly inner: CommuteProvider
  private readonly routeCache = new Map<string, RouteResult>()
  private readonly isoCache = new Map<string, IsochroneResult>()
  private readonly geocodeCache = new Map<string, PlaceCandidate[]>()
  readonly stats: CacheStats = { hits: 0, misses: 0 }

  constructor(inner: CommuteProvider) {
    this.inner = inner
    this.name = inner.name
  }

  supportsMode(mode: TravelMode): boolean {
    return this.inner.supportsMode(mode)
  }

  private routeKey(input: RouteInput): string {
    return commuteCacheKey({
      origin: input.origin,
      destination: input.destination,
      mode: input.mode,
      arrivalTime: input.arrivalTime ?? DEFAULT_ARRIVAL_TIME,
      weekdayType: 'weekday',
      preference: 'time',
      provider: this.inner.name,
    })
  }

  async geocodePlace(query: string): Promise<PlaceCandidate[]> {
    const key = query.trim().toLowerCase()
    const hit = this.geocodeCache.get(key)
    if (hit) {
      this.stats.hits++
      return hit
    }
    this.stats.misses++
    const res = await this.inner.geocodePlace(query)
    this.geocodeCache.set(key, res)
    return res
  }

  async calculateRoute(input: RouteInput): Promise<RouteResult> {
    const key = this.routeKey(input)
    const hit = this.routeCache.get(key)
    if (hit) {
      this.stats.hits++
      return hit
    }
    this.stats.misses++
    const res = await this.inner.calculateRoute(input)
    this.routeCache.set(key, res)
    return res
  }

  async calculateBatchRoutes(
    input: BatchRouteInput,
  ): Promise<Array<RouteResult & { id: string }>> {
    const results: Array<RouteResult & { id: string }> = []
    const missing: BatchRouteInput['origins'] = []
    for (const origin of input.origins) {
      const key = this.routeKey({
        origin,
        destination: input.destination,
        mode: input.mode,
        arrivalTime: input.arrivalTime,
      })
      const hit = this.routeCache.get(key)
      if (hit) {
        this.stats.hits++
        results.push({ ...hit, id: origin.id })
      } else {
        missing.push(origin)
      }
    }
    if (missing.length > 0) {
      this.stats.misses += missing.length
      const fetched = await this.inner.calculateBatchRoutes({
        ...input,
        origins: missing,
      })
      for (const r of fetched) {
        const origin = missing.find((o) => o.id === r.id)!
        const key = this.routeKey({
          origin,
          destination: input.destination,
          mode: input.mode,
          arrivalTime: input.arrivalTime,
        })
        this.routeCache.set(key, r)
        results.push(r)
      }
    }
    return results
  }

  async calculateIsochrone(input: IsochroneInput): Promise<IsochroneResult> {
    const key = isochroneCacheKey(
      input.center,
      input.mode,
      input.timeLimitMinutes,
      input.arrivalTime ?? DEFAULT_ARRIVAL_TIME,
    )
    const hit = this.isoCache.get(key)
    if (hit) {
      this.stats.hits++
      return hit
    }
    this.stats.misses++
    const res = await this.inner.calculateIsochrone(input)
    this.isoCache.set(key, res)
    return res
  }
}
