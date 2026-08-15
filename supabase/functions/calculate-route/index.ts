import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { commuteCacheKey } from '../_shared/cacheKey.ts'
import { navitimeKey, navitimeTransitRoute } from '../_shared/navitime.ts'

interface RouteBody {
  cacheKey?: string
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  mode: string
  arrivalTime?: string
}

const CACHE_TTL_HOURS = 24 * 7

/**
 * Server-side single route calculation. Checks commute_cache first,
 * then calls NAVITIME (transit) or OpenRouteService (walk/bicycle/car)
 * when the corresponding API keys are configured as function secrets.
 * Returns 503 provider_unavailable when no provider key is set so the
 * frontend can fall back to demo estimation.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = (await req.json()) as RouteBody
    if (!body?.origin || !body.destination || !body.mode) {
      return jsonResponse({ error: 'invalid body' }, 400)
    }
    const cacheKey = body.cacheKey ?? commuteCacheKey(body)
    const sb = getAdminClient()

    const { data: hit } = await sb
      .from('commute_cache')
      .select('result, provider, is_estimated, computed_at')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (hit) {
      return jsonResponse({ route: { ...hit.result, fromCache: true } })
    }

    const orsKey = Deno.env.get('ORS_API_KEY')
    const isTransit = body.mode === 'transit' || body.mode === 'walk_transit'

    let result: Record<string, unknown> | null = null

    if (isTransit && navitimeKey()) {
      result = (await navitimeTransitRoute(
        body.origin,
        body.destination,
        body.arrivalTime,
      )) as unknown as Record<string, unknown> | null
    } else if (!isTransit && orsKey) {
      const profile =
        body.mode === 'car'
          ? 'driving-car'
          : body.mode === 'bicycle'
            ? 'cycling-regular'
            : 'foot-walking'
      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/${profile}`,
        {
          method: 'POST',
          headers: {
            Authorization: orsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [body.origin.lng, body.origin.lat],
              [body.destination.lng, body.destination.lat],
            ],
          }),
        },
      )
      if (res.ok) {
        const data = await res.json()
        const seconds = data?.routes?.[0]?.summary?.duration
        if (typeof seconds === 'number') {
          const minutes = Math.round(seconds / 60)
          result = {
            durationMinutes: minutes,
            walkingMinutes: body.mode === 'walk' ? minutes : 0,
            transferCount: 0,
            estimatedCostYen: null,
            legs: [{ kind: body.mode, minutes }],
            summary: `${body.mode} route (OpenRouteService)`,
            provider: 'openrouteservice',
            isEstimated: false,
            computedAt: new Date().toISOString(),
          }
        }
      }
    }

    if (!result) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }

    await sb.from('commute_cache').upsert({
      cache_key: cacheKey,
      origin_lat: body.origin.lat,
      origin_lng: body.origin.lng,
      dest_lat: body.destination.lat,
      dest_lng: body.destination.lng,
      mode: body.mode,
      arrival_bucket: body.arrivalTime ?? '',
      provider: result.provider as string,
      is_estimated: Boolean(result.isEstimated),
      result,
      expires_at: new Date(
        Date.now() + CACHE_TTL_HOURS * 3600 * 1000,
      ).toISOString(),
    })

    return jsonResponse({ route: result })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
