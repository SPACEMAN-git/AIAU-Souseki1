import { describe, expect, it } from 'vitest'
import { haversineKm, estimateMinutes, estimateRadiusKm, normalizeCoord } from '../geo'
import { commuteCacheKey, timeBucket } from '../cacheKey'
import { formatRentShort, formatYen, formatMinutes } from '../format'
import { matchesFilters, filterByCommute, sortListings } from '../filters'
import { scoreListing } from '../scoring'
import { pointInPolygon } from '../pointInPolygon'
import { parseListingsCsv, CSV_COLUMNS } from '../csv'
import { shortestPath } from '../dijkstra'
import { DEMO_STATIONS, DEMO_STATION_EDGES } from '../../data/demoStations'
import { generateDemoListings } from '../../data/demoListings'
import type { ListingWithCommute, RouteResult } from '../types'

const tokyo = { lat: 35.681236, lng: 139.767125 }
const shinjuku = { lat: 35.690921, lng: 139.700258 }

describe('geo', () => {
  it('haversine tokyo-shinjuku ~6km', () => {
    const d = haversineKm(tokyo, shinjuku)
    expect(d).toBeGreaterThan(5)
    expect(d).toBeLessThan(7.5)
  })
  it('walk estimate is slower than car', () => {
    expect(estimateMinutes(tokyo, shinjuku, 'walk')).toBeGreaterThan(
      estimateMinutes(tokyo, shinjuku, 'car'),
    )
  })
  it('radius grows with time', () => {
    expect(estimateRadiusKm('transit', 60)).toBeGreaterThan(
      estimateRadiusKm('transit', 30),
    )
  })
  it('normalizeCoord rounds', () => {
    expect(normalizeCoord(35.123456, 3)).toBe(35.123)
  })
})

describe('cacheKey', () => {
  it('buckets time to 30 min', () => {
    expect(timeBucket('09:10')).toBe(timeBucket('09:20'))
    expect(timeBucket('09:10')).not.toBe(timeBucket('09:40'))
  })
  it('same inputs give same key', () => {
    const input = {
      origin: tokyo,
      destination: shinjuku,
      mode: 'transit' as const,
      arrivalTime: '09:00',
      weekdayType: 'weekday' as const,
      preference: 'time',
      provider: 'demo' as const,
    }
    expect(commuteCacheKey(input)).toBe(commuteCacheKey(input))
  })
  it('different mode gives different key', () => {
    const base = {
      origin: tokyo,
      destination: shinjuku,
      arrivalTime: '09:00',
      weekdayType: 'weekday' as const,
      preference: 'time',
      provider: 'demo' as const,
    }
    expect(commuteCacheKey({ ...base, mode: 'transit' })).not.toBe(
      commuteCacheKey({ ...base, mode: 'walk' }),
    )
  })
})

describe('format', () => {
  it('formats rent short', () => {
    expect(formatRentShort(85000)).toBe('8.5万円')
    expect(formatRentShort(120000)).toBe('12万円')
  })
  it('formats yen', () => {
    expect(formatYen(85000)).toBe('¥85,000')
    expect(formatYen(null)).toBe('—')
  })
  it('formats minutes', () => {
    expect(formatMinutes(75)).toBe('1時間15分')
    expect(formatMinutes(30)).toBe('30分')
  })
})

function demoListing(over: Partial<ListingWithCommute> = {}): ListingWithCommute {
  return { ...generateDemoListings(1)[0], ...over }
}

function route(minutes: number, transfers = 0): RouteResult {
  return {
    durationMinutes: minutes,
    walkingMinutes: 5,
    transferCount: transfers,
    estimatedCostYen: 200,
    legs: [],
    summary: 'test',
    provider: 'demo',
    isEstimated: true,
    computedAt: new Date().toISOString(),
  }
}

describe('filters', () => {
  it('rent range filter', () => {
    const l = demoListing({ monthlyRent: 90000 })
    expect(matchesFilters(l, { maxRent: 80000 })).toBe(false)
    expect(matchesFilters(l, { minRent: 50000, maxRent: 100000 })).toBe(true)
  })
  it('area range filter', () => {
    const l = demoListing({ floorArea: 42 })
    expect(matchesFilters(l, { maxArea: 30 })).toBe(false)
    expect(matchesFilters(l, { minArea: 50 })).toBe(false)
    expect(matchesFilters(l, { minArea: 30, maxArea: 50 })).toBe(true)
  })
  it('filterByCommute drops over-limit and missing routes', () => {
    const items = [
      demoListing({ id: 'a', commute: route(25) }),
      demoListing({ id: 'b', commute: route(45) }),
      demoListing({ id: 'c', commute: undefined }),
    ]
    const out = filterByCommute(items, 30)
    expect(out.map((l) => l.id)).toEqual(['a'])
  })
  it('sorts by rent ascending', () => {
    const items = [
      demoListing({ id: 'x', monthlyRent: 120000 }),
      demoListing({ id: 'y', monthlyRent: 60000 }),
    ]
    expect(sortListings(items, 'rent_asc')[0].id).toBe('y')
  })
})

describe('scoring', () => {
  it('shorter commute scores higher', () => {
    const fast = demoListing({ commute: route(10) })
    const slow = demoListing({ commute: route(58) })
    expect(scoreListing(fast, 60).score).toBeGreaterThan(
      scoreListing(slow, 60).score,
    )
  })
  it('score is 0-100 with reasons', () => {
    const r = scoreListing(demoListing({ commute: route(20) }), 30)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.reasons.length).toBeGreaterThan(0)
  })
})

describe('pointInPolygon', () => {
  const square: import('geojson').Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [139, 35],
        [140, 35],
        [140, 36],
        [139, 36],
        [139, 35],
      ],
    ],
  }
  it('inside / outside', () => {
    expect(pointInPolygon({ lat: 35.5, lng: 139.5 }, square)).toBe(true)
    expect(pointInPolygon({ lat: 34.5, lng: 139.5 }, square)).toBe(false)
  })
})

describe('csv', () => {
  const header = CSV_COLUMNS.join(',')
  it('parses valid row', () => {
    const row =
      'ext1,テスト物件,東京都新宿区1-1,80000,5000,1K,25.5,10,新宿,8,35.69,139.70,'
    const res = parseListingsCsv(`${header}\n${row}`)
    expect(res.valid).toHaveLength(1)
    expect(res.errors).toHaveLength(0)
  })
  it('rejects missing required fields', () => {
    const row = ',テスト,住所,80000,,,25,,,,,,'
    const res = parseListingsCsv(`${header}\n${row}`)
    expect(res.valid).toHaveLength(0)
    expect(res.errors).toHaveLength(1)
  })
  it('rejects missing columns', () => {
    const res = parseListingsCsv('external_id,title\nabc,def')
    expect(res.errors[0].message).toContain('missing columns')
  })
})

describe('dijkstra demo network', () => {
  it('finds a path Tokyo -> Shinjuku', () => {
    const path = shortestPath(
      DEMO_STATIONS,
      DEMO_STATION_EDGES,
      'st_tokyo',
      'st_shinjuku',
    )
    expect(path).not.toBeNull()
    expect(path!.minutes).toBeGreaterThan(5)
    expect(path!.minutes).toBeLessThan(40)
  })
  it('returns null for unknown station', () => {
    expect(
      shortestPath(DEMO_STATIONS, DEMO_STATION_EDGES, 'st_tokyo', 'nowhere'),
    ).toBeNull()
  })
})

describe('demo listings', () => {
  it('is deterministic and flagged as demo', () => {
    const a = generateDemoListings(10)
    const b = generateDemoListings(10)
    expect(a.map((l) => l.id)).toEqual(b.map((l) => l.id))
    expect(a.every((l) => l.isDemo)).toBe(true)
  })
})
