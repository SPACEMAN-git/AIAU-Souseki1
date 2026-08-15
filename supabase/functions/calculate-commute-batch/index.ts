import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { commuteCacheKey } from '../_shared/cacheKey.ts'
import {
  navitimeKey,
  navitimeMaxCalls,
  navitimeTransitRoute,
  type RouteResult,
} from '../_shared/navitime.ts'

const CACHE_TTL_HOURS = 24 * 3
const CONCURRENCY = 6

interface Origin {
  id: string
  lat: number
  lng: number
}

/** Cheap ordering metric (no need for true distance) with lat scaling. */
function squaredDistance(a: Origin, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat
  const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)
  return dLat * dLat + dLng * dLng
}

/**
 * Batch commute verification. NAVITIME has no batch endpoint, so misses
 * are fanned out with limited concurrency behind the shared
 * commute_cache; the per-request call budget guards the API quota.
 * When there are more uncached origins than the budget allows, the
 * ones closest to the destination are routed first and the remaining
 * (farthest, hence least likely to be inside the commute limit) are
 * skipped rather than degrading the whole batch to estimates.
 * Returns 503 provider_unavailable only when the key is missing, the
 * mode is not transit, or no route could be produced at all.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = (await req.json()) as {
      origins?: Origin[]
      destination?: { lat: number; lng: number }
      mode?: string
      arrivalTime?: string
    }
    if (!body?.origins?.length || !body.destination || !body.mode) {
      return jsonResponse({ error: 'invalid body' }, 400)
    }
    const isTransit = body.mode === 'transit' || body.mode === 'walk_transit'
    if (!isTransit || !navitimeKey()) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }

    const destination = body.destination
    const mode = body.mode
    const sb = getAdminClient()
    const keyOf = (o: Origin) =>
      commuteCacheKey({
        origin: o,
        destination,
        mode,
        arrivalTime: body.arrivalTime,
        provider: 'navitime',
      })

    const cacheKeys = body.origins.map(keyOf)
    const { data: hits } = await sb
      .from('commute_cache')
      .select('cache_key, result')
      .in('cache_key', cacheKeys)
      .gt('expires_at', new Date().toISOString())
    const cached = new Map<string, RouteResult>(
      (hits ?? []).map((h) => [
        h.cache_key as string,
        h.result as RouteResult,
      ]),
    )

    const routes: Array<RouteResult & { id: string }> = []
    const misses: Origin[] = []
    for (const o of body.origins) {
      const hit = cached.get(keyOf(o))
      if (hit) routes.push({ ...hit, id: o.id })
      else misses.push(o)
    }

    const budget = navitimeMaxCalls()
    const byDistance = misses.sort(
      (a, b) => squaredDistance(a, destination) - squaredDistance(b, destination),
    )
    const targets = byDistance.slice(0, budget)
    const skipped = byDistance.length - targets.length

    let failed = 0
    const queue = [...targets]
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        for (;;) {
          const o = queue.shift()
          if (!o) return
          let route: RouteResult | null = null
          try {
            route = await navitimeTransitRoute(o, destination, body.arrivalTime)
          } catch {
            route = null
          }
          if (!route) {
            failed++
            continue
          }
          routes.push({ ...route, id: o.id })
          await sb.from('commute_cache').upsert({
            cache_key: keyOf(o),
            origin_lat: o.lat,
            origin_lng: o.lng,
            dest_lat: destination.lat,
            dest_lng: destination.lng,
            mode,
            arrival_bucket: body.arrivalTime ?? '',
            provider: route.provider,
            is_estimated: route.isEstimated,
            result: route,
            expires_at: new Date(
              Date.now() + CACHE_TTL_HOURS * 3600 * 1000,
            ).toISOString(),
          })
        }
      },
    )
    await Promise.all(workers)

    if (routes.length === 0) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }
    return jsonResponse({
      routes,
      stats: {
        requested: body.origins.length,
        cacheHits: routes.length - (targets.length - failed),
        apiCalls: targets.length,
        failed,
        skipped,
      },
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
