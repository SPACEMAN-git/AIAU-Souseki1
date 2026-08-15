import type {
  Listing,
  ListingFilters,
  ListingWithCommute,
  SortKey,
} from './types'

export function matchesFilters(l: Listing, f: ListingFilters): boolean {
  if (!l.isAvailable) return false
  if (f.minRent != null && l.monthlyRent < f.minRent) return false
  if (f.maxRent != null && l.monthlyRent > f.maxRent) return false
  if (f.minArea != null && l.floorArea < f.minArea) return false
  if (f.maxArea != null && l.floorArea > f.maxArea) return false
  if (f.layouts && f.layouts.length > 0 && !f.layouts.includes(l.layout))
    return false
  if (f.maxBuildingAge != null && l.buildingAge > f.maxBuildingAge) return false
  if (f.maxStationWalk != null && l.walkMinutesToStation > f.maxStationWalk)
    return false
  const boolKeys = [
    'petsAllowed',
    'furnished',
    'bathToiletSeparate',
    'autoLock',
    'deliveryBox',
    'parkingAvailable',
    'bicycleParking',
    'internetFree',
  ] as const
  for (const k of boolKeys) {
    if (f[k] === true && !l[k]) return false
  }
  return true
}

export function filterByCommute(
  listings: ListingWithCommute[],
  maxMinutes: number,
): ListingWithCommute[] {
  return listings.filter(
    (l) => l.commute != null && l.commute.durationMinutes <= maxMinutes,
  )
}

export function sortListings(
  listings: ListingWithCommute[],
  key: SortKey,
): ListingWithCommute[] {
  const arr = [...listings]
  const by = <T>(fn: (l: ListingWithCommute) => T, asc = true) =>
    arr.sort((a, b) => {
      const va = fn(a)
      const vb = fn(b)
      if (va === vb) return 0
      return (va < vb ? -1 : 1) * (asc ? 1 : -1)
    })
  switch (key) {
    case 'recommended':
      return by((l) => l.score ?? 0, false)
    case 'commute':
      return by((l) => l.commute?.durationMinutes ?? Infinity)
    case 'rent_asc':
      return by((l) => l.monthlyRent + l.managementFee)
    case 'area_desc':
      return by((l) => l.floorArea, false)
    case 'station_walk':
      return by((l) => l.walkMinutesToStation)
    case 'newest_building':
      return by((l) => l.buildingAge)
    case 'initial_cost':
      return by((l) => l.deposit + l.keyMoney + l.monthlyRent)
    case 'updated':
      return by((l) => l.updatedAt, false)
  }
}
