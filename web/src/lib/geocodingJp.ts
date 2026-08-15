import type { PlaceCandidate } from './types'
import { SUPABASE_ENABLED } from './config'
import { invokeEdge } from './supabase'

/**
 * Geocoding.jp を使った住所→座標変換。
 * - Supabase 設定時は Edge Function `geocode-place` 経由（サーバー側キャッシュあり）
 * - 未設定時は Vite dev プロキシ `/geocoding-api` 経由で直接 XML を取得
 * 約 10 秒に 1 リクエストの制限があるため、クライアント側でも最小間隔を守る。
 */
const MIN_INTERVAL_MS = 10_000
let lastRequestAt = 0

const PREF_RE =
  /(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/

function extractPrefecture(address: string): string {
  const m = address.match(PREF_RE)
  return m ? m[1] : ''
}

function parseGeocodingXml(xml: string, query: string): PlaceCandidate[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('error')) return []
  const lat = Number(doc.querySelector('coordinate > lat')?.textContent)
  const lng = Number(doc.querySelector('coordinate > lng')?.textContent)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const address = doc.querySelector('address')?.textContent?.trim() || query
  return [
    {
      id: `geocoding_jp:${lat.toFixed(6)},${lng.toFixed(6)}`,
      name: query,
      address,
      placeType: 'address',
      prefecture: extractPrefecture(address),
      lat,
      lng,
      provider: 'geocoding_jp',
    },
  ]
}

export async function geocodeAddress(
  query: string,
): Promise<PlaceCandidate[]> {
  const q = query.trim()
  if (!q) return []

  if (SUPABASE_ENABLED) {
    const data = await invokeEdge<{ candidates?: PlaceCandidate[] }>(
      'geocode-place',
      { query: q },
    )
    return data.candidates ?? []
  }

  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()

  const res = await fetch(`/geocoding-api/api/?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error(`geocoding.jp ${res.status}`)
  return parseGeocodingXml(await res.text(), q)
}
