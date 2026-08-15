import type { PlaceCandidate } from '../lib/types'
import { DEMO_STATIONS } from './demoStations'

/** Offline place candidates for Demo Mode geocoding. */
export const DEMO_PLACES: PlaceCandidate[] = [
  {
    id: 'place_tokyo_st',
    name: '東京駅（丸の内オフィス街）',
    address: '東京都千代田区丸の内1丁目',
    placeType: 'company',
    prefecture: '東京都',
    lat: 35.6812,
    lng: 139.7671,
    provider: 'demo',
  },
  {
    id: 'place_shinjuku_office',
    name: '新宿西口オフィス街',
    address: '東京都新宿区西新宿2丁目',
    placeType: 'company',
    prefecture: '東京都',
    lat: 35.6894,
    lng: 139.6917,
    provider: 'demo',
  },
  {
    id: 'place_shibuya_office',
    name: '渋谷スクランブルスクエア周辺',
    address: '東京都渋谷区渋谷2丁目',
    placeType: 'company',
    prefecture: '東京都',
    lat: 35.6585,
    lng: 139.7024,
    provider: 'demo',
  },
  {
    id: 'place_shinagawa_office',
    name: '品川駅港南口オフィス街',
    address: '東京都港区港南2丁目',
    placeType: 'company',
    prefecture: '東京都',
    lat: 35.6284,
    lng: 139.7408,
    provider: 'demo',
  },
  {
    id: 'place_akihabara',
    name: '秋葉原駅周辺',
    address: '東京都千代田区外神田1丁目',
    placeType: 'company',
    prefecture: '東京都',
    lat: 35.6984,
    lng: 139.7731,
    provider: 'demo',
  },
  ...DEMO_STATIONS.map(
    (s): PlaceCandidate => ({
      id: `place_${s.id}`,
      name: `${s.name}駅`,
      address: `東京都 ${s.line}`,
      placeType: 'station',
      prefecture: '東京都',
      lat: s.lat,
      lng: s.lng,
      provider: 'demo',
    }),
  ),
]
