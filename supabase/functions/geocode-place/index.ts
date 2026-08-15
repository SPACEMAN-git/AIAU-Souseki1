import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { navitimePlaceSearch, type PlaceHit } from '../_shared/navitimeSearch.ts'

/**
 * Geocodes a free-text place query server-side so no provider keys
 * reach the browser. Order: places cache -> NAVITIME station/address
 * search -> Geocoding.jp (free, ~1 req / 10 s, low volume only).
 *
 * Geocoding.jp alone is not enough: it returns error 001 for station and
 * landmark names (「上野駅」「上野公園」), so NAVITIME is tried first.
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
      const unique = dedupe(
        cached,
        (p) => `${p.name}@${p.latitude},${p.longitude}`,
      )
      return jsonResponse({
        candidates: unique.map((p) => ({
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

    let hits: PlaceHit[] = []
    let provider = 'navitime'
    try {
      hits = await navitimePlaceSearch(q)
    } catch {
      hits = []
    }

    if (hits.length === 0) {
      const jp = await geocodingJp(q)
      if (jp) {
        hits = [jp]
        provider = 'geocoding_jp'
      }
    }

    if (hits.length === 0) return jsonResponse({ candidates: [] })

    const rows = hits.map((h) => ({
      query: q,
      name: h.name,
      address: h.address,
      place_type: h.placeType,
      prefecture: prefectureOf(h.address),
      latitude: h.lat,
      longitude: h.lng,
      provider,
    }))
    const { data: inserted } = await sb.from('places').insert(rows).select()

    return jsonResponse({
      candidates: hits.map((h, i) => ({
        id: inserted?.[i]?.id ?? crypto.randomUUID(),
        name: h.name,
        address: h.address,
        placeType: h.placeType,
        prefecture: prefectureOf(h.address) ?? '',
        lat: h.lat,
        lng: h.lng,
        provider,
      })),
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})

/** Older cache rows can contain the same place twice. */
function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const k = key(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function prefectureOf(address: string): string | null {
  return address.match(/^(.{2,3}?[都道府県])/)?.[1] ?? null
}

/** Geocoding.jp free API: XML, forward geocoding of addresses only. */
async function geocodingJp(q: string): Promise<PlaceHit | null> {
  const res = await fetch(
    `https://www.geocoding.jp/api/?q=${encodeURIComponent(q)}`,
  )
  const xml = await res.text()
  const lat = xml.match(/<lat>([\d.-]+)<\/lat>/)?.[1]
  const lng = xml.match(/<lng>([\d.-]+)<\/lng>/)?.[1]
  if (!lat || !lng) return null
  const address = xml.match(/<address>([^<]+)<\/address>/)?.[1] ?? q
  return {
    name: q,
    address,
    placeType: 'address',
    lat: Number(lat),
    lng: Number(lng),
  }
}
