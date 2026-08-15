import type {
  CommuteConditions,
  IsochroneResult,
  Listing,
  ListingFilters,
  ListingWithCommute,
  PlaceCandidate,
} from './types'
import { estimateRadiusKm, haversineKm } from './geo'
import { matchesFilters, filterByCommute } from './filters'
import { pointInPolygon } from './pointInPolygon'
import { scoreListing, type ScoreWeights, DEFAULT_WEIGHTS } from './scoring'
import { withFallback, cachedProviders } from '../providers'
import { DEMO_LISTINGS } from '../data/demoListings'
import { SUPABASE_ENABLED } from './config'
import { getSupabase } from './supabase'
import type { DebugStats } from '../store/appStore'

export interface SearchOutput {
  results: ListingWithCommute[]
  isochrone: IsochroneResult | null
  fallbackUsed: boolean
  debug: DebugStats
}

interface DbListingRow {
  id: string
  external_id: string
  title: string
  description: string | null
  property_name: string | null
  address: string
  prefecture: string | null
  city: string | null
  district: string | null
  latitude: number
  longitude: number
  monthly_rent: number
  management_fee: number
  deposit: number
  key_money: number
  layout: string | null
  floor_area: number
  building_age: number
  built_year: number | null
  floor_number: number | null
  total_floors: number | null
  structure_type: string | null
  nearest_station_name: string | null
  walk_minutes_to_station: number | null
  railway_line: string | null
  image_urls: string[] | null
  source_name: string | null
  source_url: string | null
  is_available: boolean
  pets_allowed: boolean
  furnished: boolean
  bath_toilet_separate: boolean
  auto_lock: boolean
  delivery_box: boolean
  parking_available: boolean
  bicycle_parking: boolean
  internet_free: boolean
  air_conditioner: boolean
  balcony: boolean
  is_demo: boolean
  updated_at: string
}

function rowToListing(r: DbListingRow): Listing {
  return {
    id: r.id,
    externalId: r.external_id,
    title: r.title,
    description: r.description ?? '',
    propertyName: r.property_name ?? '',
    address: r.address,
    prefecture: r.prefecture ?? '',
    city: r.city ?? '',
    district: r.district ?? '',
    lat: r.latitude,
    lng: r.longitude,
    monthlyRent: r.monthly_rent,
    managementFee: r.management_fee,
    deposit: r.deposit,
    keyMoney: r.key_money,
    layout: r.layout ?? '',
    floorArea: r.floor_area,
    buildingAge: r.building_age,
    builtYear: r.built_year ?? 0,
    floorNumber: r.floor_number ?? 0,
    totalFloors: r.total_floors ?? 0,
    structureType: r.structure_type ?? '',
    nearestStationName: r.nearest_station_name ?? '',
    walkMinutesToStation: r.walk_minutes_to_station ?? 99,
    railwayLine: r.railway_line ?? '',
    imageUrls: r.image_urls ?? [],
    sourceName: r.source_name ?? '',
    sourceUrl: r.source_url ?? '',
    isAvailable: r.is_available,
    petsAllowed: r.pets_allowed,
    furnished: r.furnished,
    bathToiletSeparate: r.bath_toilet_separate,
    autoLock: r.auto_lock,
    deliveryBox: r.delivery_box,
    parkingAvailable: r.parking_available,
    bicycleParking: r.bicycle_parking,
    internetFree: r.internet_free,
    airConditioner: r.air_conditioner,
    balcony: r.balcony,
    isDemo: r.is_demo,
    updatedAt: r.updated_at,
  }
}

/**
 * Step 1 data access: fetch listings within a radius. Uses the
 * PostGIS-backed RPC when Supabase is configured, otherwise the
 * bundled demo dataset.
 */
async function fetchCandidates(
  center: PlaceCandidate,
  radiusKm: number,
  filters: ListingFilters,
): Promise<Listing[]> {
  const sb = SUPABASE_ENABLED ? getSupabase() : null
  if (sb) {
    const { data, error } = await sb.rpc('search_listings_in_radius', {
      p_lat: center.lat,
      p_lng: center.lng,
      p_radius_m: Math.round(radiusKm * 1000),
      p_min_rent: filters.minRent ?? null,
      p_max_rent: filters.maxRent ?? null,
      p_min_area: filters.minArea ?? null,
      p_layouts: filters.layouts?.length ? filters.layouts : null,
      p_max_building_age: filters.maxBuildingAge ?? null,
      p_max_station_walk: filters.maxStationWalk ?? null,
      p_limit: 500,
    })
    if (!error && Array.isArray(data)) {
      return (data as DbListingRow[]).map(rowToListing)
    }
  }
  return DEMO_LISTINGS.filter(
    (l) =>
      haversineKm(l, center) <= radiusKm && matchesFilters(l, filters),
  )
}

/**
 * Layered commute search:
 * 1. radius prefilter (PostGIS or in-memory haversine)
 * 2. isochrone polygon filter
 * 3. batch route verification via provider chain (with caching)
 * 4. final max-commute filter + scoring
 */
export async function runCommuteSearch(
  company: PlaceCandidate,
  conditions: CommuteConditions,
  filters: ListingFilters,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  signal?: AbortSignal,
): Promise<SearchOutput> {
  const started = performance.now()
  let fallbackUsed = false
  const onFallback = () => {
    fallbackUsed = true
  }
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  }

  const radiusKm = estimateRadiusKm(conditions.mode, conditions.maxMinutes)
  const candidates = await fetchCandidates(company, radiusKm * 1.2, filters)
  throwIfAborted()
  const prefilterCount = candidates.length

  let isochrone: IsochroneResult | null = null
  try {
    // The isochrone is only a prefilter, so falling back to the demo
    // polygon here does not make the commute times estimated.
    isochrone = await withFallback(conditions.mode, (p) =>
      p.calculateIsochrone({
        center: company,
        mode: conditions.mode,
        timeLimitMinutes: conditions.maxMinutes,
        arrivalTime: conditions.arrivalTime,
      }),
    )
  } catch {
    isochrone = null
  }
  throwIfAborted()

  const inArea = isochrone
    ? candidates.filter((l) => pointInPolygon(l, isochrone.polygon))
    : candidates
  const isochroneCount = inArea.length

  const routes = await withFallback(
    conditions.mode,
    (p) =>
      p.calculateBatchRoutes({
        origins: inArea.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng })),
        destination: { lat: company.lat, lng: company.lng },
        mode: conditions.mode,
        arrivalTime: conditions.arrivalTime,
      }),
    onFallback,
  )
  throwIfAborted()

  const routeById = new Map(routes.map((r) => [r.id, r]))
  const withCommute: ListingWithCommute[] = inArea.map((l) => ({
    ...l,
    commute: routeById.get(l.id),
    distanceKm: Math.round(haversineKm(l, company) * 10) / 10,
  }))

  let final = filterByCommute(withCommute, conditions.maxMinutes)
  final = final.filter(
    (l) =>
      (l.commute?.transferCount ?? 0) <= conditions.maxTransfers &&
      l.walkMinutesToStation <= conditions.maxStationWalk,
  )
  for (const l of final) {
    const { score, reasons } = scoreListing(l, conditions.maxMinutes, weights)
    l.score = score
    l.scoreReasons = reasons
  }

  const stats = cachedProviders.demo.stats
  return {
    results: final,
    isochrone,
    fallbackUsed,
    debug: {
      provider: routes[0]?.provider ?? 'demo',
      apiCalls: stats.misses,
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
      phase: 'done',
      prefilterCount,
      isochroneCount,
      verifiedCount: routes.length,
      finalCount: final.length,
      elapsedMs: Math.round(performance.now() - started),
    },
  }
}
