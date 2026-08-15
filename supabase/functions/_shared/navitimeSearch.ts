/**
 * Place search via the NAVITIME RapidAPI gateway: stations
 * (navitime-transport /transport_node) and addresses
 * (navitime-geocoding /address). Keys stay server-side.
 */

import { navitimeKey } from './navitime.ts'

export interface PlaceHit {
  name: string
  address: string
  placeType: 'station' | 'address'
  lat: number
  lng: number
}

const TRANSPORT_HOST = 'navitime-transport.p.rapidapi.com'
const GEOCODING_HOST = 'navitime-geocoding.p.rapidapi.com'

interface NavitimeCoord {
  lat?: number
  lon?: number
}

interface NavitimeNode {
  name?: string
  address_name?: string
  coord?: NavitimeCoord
}

async function search(
  host: string,
  path: string,
  word: string,
  limit: number,
): Promise<NavitimeNode[]> {
  const key = navitimeKey()
  if (!key) return []
  const params = new URLSearchParams({ word, limit: String(limit) })
  const res = await fetch(`https://${host}${path}?${params}`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { items?: NavitimeNode[] }
  return data.items ?? []
}

function toHits(
  items: NavitimeNode[],
  placeType: PlaceHit['placeType'],
  suffix: string,
): PlaceHit[] {
  const hits: PlaceHit[] = []
  for (const it of items) {
    const lat = it.coord?.lat
    const lng = it.coord?.lon
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const name = it.name?.trim()
    if (!name) continue
    hits.push({
      name: suffix && !name.endsWith(suffix) ? `${name}${suffix}` : name,
      address: it.address_name?.trim() || name,
      placeType,
      lat,
      lng,
    })
  }
  return hits
}

/**
 * Searches stations and addresses in parallel. Needed because Geocoding.jp
 * returns error 001 for station and landmark names such as 「上野駅」.
 * Station hits are ranked first only when the query looks like a station
 * name, so 「上野公園」 still resolves to the area rather than 京成上野駅.
 */
export async function navitimePlaceSearch(
  query: string,
  limit = 5,
): Promise<PlaceHit[]> {
  if (!navitimeKey()) return []
  const stationQuery = /駅$/.test(query)
  const [stations, addresses] = await Promise.all([
    search(TRANSPORT_HOST, '/transport_node', query.replace(/駅$/, ''), limit),
    search(GEOCODING_HOST, '/address', query, limit),
  ])
  const stationHits = toHits(stations, 'station', '駅')
  const addressHits = toHits(addresses, 'address', '')
  const ordered = stationQuery
    ? [...stationHits, ...addressHits]
    : [...addressHits, ...stationHits]
  return ordered.slice(0, limit * 2)
}
