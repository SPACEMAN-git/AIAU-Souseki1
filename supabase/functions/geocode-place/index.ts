import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

/**
 * Geocodes a free-text place query server-side so no provider keys
 * reach the browser. Order: places cache -> NAVITIME (if key set)
 * -> Geocoding.jp (free, ~1 req / 10 s, low volume only).
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const { query } = (await req.json()) as { query?: string }
    if (!query || query.trim().length < 1) {
      return jsonResponse({ error: 'query required' }, 400)
    }
    const q = query.trim()
    const sb = getAdminClient()

    const { data: cached } = await sb
      .from('places')
      .select('*')
      .eq('query', q)
      .limit(10)
    if (cached && cached.length > 0) {
      return jsonResponse({
        candidates: cached.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          placeType: p.place_type,
          prefecture: p.prefecture ?? '',
          lat: p.latitude,
          lng: p.longitude,
          provider: 'cache',
        })),
      })
    }

    const navitimeKey = Deno.env.get('NAVITIME_API_KEY')
    if (navitimeKey) {
      // NAVITIME address/POI search (contract-dependent endpoint).
      // Left as the integration point; not called without a contract.
      // Fallthrough to Geocoding.jp below when not implemented.
    }

    // Geocoding.jp free API: XML, forward geocoding only.
    const res = await fetch(
      `https://www.geocoding.jp/api/?q=${encodeURIComponent(q)}`,
    )
    const xml = await res.text()
    const lat = xml.match(/<lat>([\d.-]+)<\/lat>/)?.[1]
    const lng = xml.match(/<lng>([\d.-]+)<\/lng>/)?.[1]
    const address = xml.match(/<address>([^<]+)<\/address>/)?.[1] ?? q
    if (!lat || !lng) {
      return jsonResponse({ candidates: [] })
    }
    const candidate = {
      name: q,
      address,
      place_type: 'address',
      prefecture: address.match(/^(.{2,3}?[都道府県])/)?.[1] ?? null,
      latitude: Number(lat),
      longitude: Number(lng),
      provider: 'geolonia',
      query: q,
    }
    const { data: inserted } = await sb
      .from('places')
      .insert(candidate)
      .select()
      .single()
    return jsonResponse({
      candidates: [
        {
          id: inserted?.id ?? crypto.randomUUID(),
          name: q,
          address,
          placeType: 'address',
          prefecture: candidate.prefecture ?? '',
          lat: Number(lat),
          lng: Number(lng),
          provider: 'geolonia',
        },
      ],
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
