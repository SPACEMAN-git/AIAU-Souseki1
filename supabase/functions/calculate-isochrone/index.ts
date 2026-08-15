import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

const CACHE_TTL_HOURS = 24 * 30

/**
 * Isochrone (reachable-area) polygons. Uses OpenRouteService isochrones
 * for walk/bicycle/car when ORS_API_KEY is set; NAVITIME reachable-area
 * is the integration point for transit. Cached in isochrone_cache.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = (await req.json()) as {
      cacheKey?: string
      center?: { lat: number; lng: number }
      mode?: string
      timeLimitMinutes?: number
    }
    if (!body?.cacheKey || !body.center || !body.timeLimitMinutes) {
      return jsonResponse({ error: 'invalid body' }, 400)
    }
    const sb = getAdminClient()
    const { data: hit } = await sb
      .from('isochrone_cache')
      .select('polygon, provider, is_estimated, computed_at')
      .eq('cache_key', body.cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (hit) {
      return jsonResponse({
        polygon: hit.polygon,
        provider: hit.provider,
        isEstimated: hit.is_estimated,
        computedAt: hit.computed_at,
        fromCache: true,
      })
    }

    const orsKey = Deno.env.get('ORS_API_KEY')
    const isTransit = body.mode === 'transit' || body.mode === 'walk_transit'
    if (isTransit || !orsKey) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }
    const profile =
      body.mode === 'car'
        ? 'driving-car'
        : body.mode === 'bicycle'
          ? 'cycling-regular'
          : 'foot-walking'
    const res = await fetch(
      `https://api.openrouteservice.org/v2/isochrones/${profile}`,
      {
        method: 'POST',
        headers: {
          Authorization: orsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations: [[body.center.lng, body.center.lat]],
          range: [body.timeLimitMinutes * 60],
        }),
      },
    )
    if (!res.ok) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }
    const data = await res.json()
    const polygon = data?.features?.[0]?.geometry
    if (!polygon) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }
    const result = {
      polygon,
      provider: 'openrouteservice',
      isEstimated: false,
      computedAt: new Date().toISOString(),
    }
    await sb.from('isochrone_cache').upsert({
      cache_key: body.cacheKey,
      center_lat: body.center.lat,
      center_lng: body.center.lng,
      mode: body.mode ?? '',
      time_limit_minutes: body.timeLimitMinutes,
      provider: result.provider,
      is_estimated: result.isEstimated,
      polygon,
      expires_at: new Date(
        Date.now() + CACHE_TTL_HOURS * 3600 * 1000,
      ).toISOString(),
    })
    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
