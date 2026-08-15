import type { Listing } from '../lib/types'
import { DEMO_STATIONS } from './demoStations'

/** Deterministic PRNG so demo data is stable across builds. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LAYOUTS = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']
const STRUCTURES = ['木造', '鉄骨造', 'RC造', 'SRC造']
const NAME_PARTS_A = ['グラン', 'パーク', 'サニー', 'メゾン', 'ヴィラ', 'コート', 'レジデンス', 'ハイツ']
const NAME_PARTS_B = ['桜', '緑', '光', '風', '杜', '丘', '泉', '花']

const DISTRICT_BY_STATION: Record<string, { city: string; district: string }> = {
  st_nakano: { city: '中野区', district: '中野' },
  st_koenji: { city: '杉並区', district: '高円寺南' },
  st_asagaya: { city: '杉並区', district: '阿佐谷南' },
  st_ogikubo: { city: '杉並区', district: '荻窪' },
  st_kichijoji: { city: '武蔵野市', district: '吉祥寺本町' },
  st_mitaka: { city: '三鷹市', district: '下連雀' },
  st_shinjuku: { city: '新宿区', district: '西新宿' },
  st_yoyogi: { city: '渋谷区', district: '代々木' },
  st_takadanobaba: { city: '新宿区', district: '高田馬場' },
  st_ikebukuro: { city: '豊島区', district: '南池袋' },
  st_shibuya: { city: '渋谷区', district: '道玄坂' },
  st_ebisu: { city: '渋谷区', district: '恵比寿' },
  st_nakanosakaue: { city: '中野区', district: '本町' },
  st_nishishinjuku: { city: '新宿区', district: '西新宿' },
  st_ueno: { city: '台東区', district: '上野' },
  st_akihabara: { city: '千代田区', district: '外神田' },
}

const RESIDENTIAL_STATIONS = Object.keys(DISTRICT_BY_STATION)

/**
 * Generates deterministic fictional demo listings distributed around
 * the demo station network in western/central Tokyo.
 * All listings are flagged is_demo=true and must never be presented
 * as real properties.
 */
export function generateDemoListings(count = 80): Listing[] {
  const rand = mulberry32(20240815)
  const listings: Listing[] = []
  for (let i = 0; i < count; i++) {
    const stationId =
      RESIDENTIAL_STATIONS[Math.floor(rand() * RESIDENTIAL_STATIONS.length)]
    const station = DEMO_STATIONS.find((s) => s.id === stationId)!
    const loc = DISTRICT_BY_STATION[stationId]
    const walkMin = 1 + Math.floor(rand() * 15)
    // Offset roughly walkMin * 80m from the station in a random direction.
    const distKm = (walkMin * 0.08) / 1.3
    const theta = rand() * 2 * Math.PI
    const lat = station.lat + (distKm / 111.32) * Math.sin(theta)
    const lng =
      station.lng +
      (distKm / (111.32 * Math.cos((station.lat * Math.PI) / 180))) *
        Math.cos(theta)
    const layout = LAYOUTS[Math.floor(rand() * LAYOUTS.length)]
    const layoutIdx = LAYOUTS.indexOf(layout)
    const floorArea = Math.round((16 + layoutIdx * 8 + rand() * 12) * 10) / 10
    const buildingAge = Math.floor(rand() * 35)
    const centralityBonus = ['st_shinjuku', 'st_shibuya', 'st_ebisu', 'st_yoyogi', 'st_nishishinjuku'].includes(stationId)
      ? 25000
      : 0
    const monthlyRent =
      Math.round(
        (48000 +
          floorArea * 1800 +
          centralityBonus -
          buildingAge * 700 -
          walkMin * 800 +
          rand() * 12000) /
          1000,
      ) * 1000
    const managementFee = Math.round((3000 + rand() * 9000) / 500) * 500
    const totalFloors = 2 + Math.floor(rand() * 10)
    const floorNumber = 1 + Math.floor(rand() * totalFloors)
    const name = `${NAME_PARTS_A[Math.floor(rand() * NAME_PARTS_A.length)]}${NAME_PARTS_B[Math.floor(rand() * NAME_PARTS_B.length)]}${loc.district}`
    const builtYear = 2026 - buildingAge
    const n = i + 1
    listings.push({
      id: `demo-${String(n).padStart(3, '0')}`,
      externalId: `DEMO-${String(n).padStart(4, '0')}`,
      title: `${name} ${floorNumber}F ${layout}`,
      description: `【デモ物件】${station.name}駅徒歩${walkMin}分の${layout}。このデータは架空のサンプルです。`,
      propertyName: name,
      address: `東京都${loc.city}${loc.district}${1 + Math.floor(rand() * 5)}-${1 + Math.floor(rand() * 20)}-${1 + Math.floor(rand() * 15)}`,
      prefecture: '東京都',
      city: loc.city,
      district: loc.district,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      monthlyRent,
      managementFee,
      deposit: rand() < 0.25 ? 0 : monthlyRent,
      keyMoney: rand() < 0.35 ? 0 : monthlyRent,
      layout,
      floorArea,
      buildingAge,
      builtYear,
      floorNumber,
      totalFloors,
      structureType: STRUCTURES[Math.floor(rand() * STRUCTURES.length)],
      nearestStationName: station.name,
      walkMinutesToStation: walkMin,
      railwayLine: station.line,
      imageUrls: [],
      sourceName: 'Demo Seed Data',
      sourceUrl: '',
      isAvailable: true,
      petsAllowed: rand() < 0.2,
      furnished: rand() < 0.15,
      bathToiletSeparate: rand() < 0.7,
      autoLock: rand() < 0.5,
      deliveryBox: rand() < 0.55,
      parkingAvailable: rand() < 0.25,
      bicycleParking: rand() < 0.7,
      internetFree: rand() < 0.4,
      airConditioner: rand() < 0.9,
      balcony: rand() < 0.65,
      isDemo: true,
      updatedAt: new Date(
        Date.UTC(2026, 6, 1 + Math.floor(rand() * 40)),
      ).toISOString(),
    })
  }
  return listings
}

export const DEMO_LISTINGS: Listing[] = generateDemoListings(80)
