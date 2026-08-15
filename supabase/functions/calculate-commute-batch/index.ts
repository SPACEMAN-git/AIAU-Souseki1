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
const CONCURRENCY = 4

interface Origin {
  id: string
  lat: number
  lng: number
}

/**
 * Batch commute verification. NAVITIME has no batch endpoint, so misses
 * are fanned out with limited concurrency behind the shared
 * commute_cache; the per-request call budget guards the API quota.
 * Returns 503 provider_unavailable (whole batch) when the key is
 * missing, the mode is not transit, or the budget cannot cover the
 * uncached origins, so the frontend falls back to demo estimation for
 * every listing instead of mixing real and estimated times.
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

    if (misses.length > navitimeMaxCalls()) {
      return jsonResponse(
        { error: 'provider_unavailable', reason: 'call_budget_exceeded' },
        503,
      )
    }

    let failed = 0
    const queue = [...misses]
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
        cacheHits: routes.length - (misses.length - failed),
        apiCalls: misses.length,
        failed,
      },
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
