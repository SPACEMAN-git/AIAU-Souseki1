import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { navitimePlaceSearch, type PlaceHit } from '../_shared/navitimeSearch.ts'
import { osmPlaceSearch } from '../_shared/osmSearch.ts'

/** Below this many NAVITIME hits the query also gets OSM landmark hits. */
const ENRICH_BELOW = 5

/**
 * Geocodes a free-text place query server-side so no provider keys
 * reach the browser. Order: places cache -> NAVITIME station/address
 * search (partial match, multiple candidates) -> OSM landmark search when
 * NAVITIME returns few hits -> Geocoding.jp (free, ~1 req / 10 s).
 *
 * Neither provider alone is enough: Geocoding.jp needs a complete address
 * (error 001 for 「上野駅」), NAVITIME has no facility names
 * (「東京スカイツリー」「渋谷ヒカリエ」), so both feed the suggestion list.
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
    const hitsFromCache = dedupe(
      (cached ?? []).map(cacheRowToFound),
      keyOf,
    )
    if (hitsFromCache.length > 0) {
      return jsonResponse({ candidates: hitsFromCache.map(toCandidate) })
    }

    let found: Found[] = []
    try {
      found = found.concat(tag(await navitimePlaceSearch(q), 'navitime'))
    } catch {
      /* fall through to the other providers */
    }

    if (found.length < ENRICH_BELOW) {
      found = found.concat(tag(await osmPlaceSearch(q), 'osm'))
    }

    if (found.length === 0) {
      const jp = await geocodingJp(q)
      if (jp) found = tag([jp], 'geocoding_jp')
    }

    found = dedupe(found, keyOf)
    if (found.length === 0) return jsonResponse({ candidates: [] })

    const fresh = found.filter((f) => !f.id)
    const rows = fresh.map(({ hit: h, provider }) => ({
      query: q,
      name: h.name,
      address: h.address,
      place_type: h.placeType,
      prefecture: prefectureOf(h.address),
      latitude: h.lat,
      longitude: h.lng,
      provider,
    }))
    if (rows.length > 0) {
      const { data: inserted } = await sb.from('places').insert(rows).select()
      fresh.forEach((f, i) => {
        f.id = inserted?.[i]?.id
      })
    }

    return jsonResponse({ candidates: found.map(toCandidate) })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})

interface Found {
  hit: PlaceHit
  provider: string
  /** Set once the place exists in the `places` cache table. */
  id?: string
}

interface PlaceRow {
  id: string
  name: string
  address: string
  place_type: PlaceHit['placeType']
  prefecture: string | null
  latitude: number
  longitude: number
}

function tag(hits: PlaceHit[], provider: string): Found[] {
  return hits.map((hit) => ({ hit, provider }))
}

function cacheRowToFound(row: PlaceRow): Found {
  return {
    id: row.id,
    provider: 'cache',
    hit: {
      name: row.name,
      address: row.address,
      placeType: row.place_type,
      lat: row.latitude,
      lng: row.longitude,
    },
  }
}

function keyOf({ hit }: Found): string {
  return `${hit.name}@${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`
}

function toCandidate({ hit, provider, id }: Found) {
  return {
    id: id ?? crypto.randomUUID(),
    name: hit.name,
    address: hit.address,
    placeType: hit.placeType,
    prefecture: prefectureOf(hit.address) ?? '',
    lat: hit.lat,
    lng: hit.lng,
    provider,
  }
}

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
