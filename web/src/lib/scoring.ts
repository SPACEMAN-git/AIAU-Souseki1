import type { ListingWithCommute } from './types'

export interface ScoreWeights {
  commute: number
  rent: number
  area: number
  stationWalk: number
  transfers: number
  buildingAge: number
  amenities: number
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  commute: 0.35,
  rent: 0.25,
  area: 0.15,
  stationWalk: 0.1,
  transfers: 0.05,
  buildingAge: 0.05,
  amenities: 0.05,
}

export const WEIGHT_PRESETS: Record<string, ScoreWeights> = {
  default: DEFAULT_WEIGHTS,
  commute: { ...DEFAULT_WEIGHTS, commute: 0.55, rent: 0.15, area: 0.1 },
  rent: { ...DEFAULT_WEIGHTS, rent: 0.5, commute: 0.2, area: 0.1 },
  area: { ...DEFAULT_WEIGHTS, area: 0.4, rent: 0.2, commute: 0.2 },
  newBuilding: { ...DEFAULT_WEIGHTS, buildingAge: 0.3, commute: 0.25, rent: 0.2 },
}

/** Linear score: 100 at `best` or better, 0 at `worst` or worse. */
export function linearScore(value: number, best: number, worst: number): number {
  if (best === worst) return 100
  const t = (value - worst) / (best - worst)
  return Math.max(0, Math.min(100, t * 100))
}

const AMENITY_KEYS = [
  'petsAllowed',
  'furnished',
  'bathToiletSeparate',
  'autoLock',
  'deliveryBox',
  'parkingAvailable',
  'bicycleParking',
  'internetFree',
  'airConditioner',
  'balcony',
] as const

export interface ScoreResult {
  score: number
  reasons: string[]
}

/**
 * Computes a deterministic 0-100 recommendation score.
 * All sub-scores are explainable linear normalizations.
 */
export function scoreListing(
  listing: ListingWithCommute,
  maxCommuteMinutes: number,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoreResult {
  const commuteMin = listing.commute?.durationMinutes
  const commuteScore =
    commuteMin != null ? linearScore(commuteMin, 10, maxCommuteMinutes) : 50
  const rentScore = linearScore(
    listing.monthlyRent + listing.managementFee,
    50000,
    200000,
  )
  const areaScore = linearScore(listing.floorArea, 60, 15)
  const stationScore = linearScore(listing.walkMinutesToStation, 1, 20)
  const transferScore =
    listing.commute != null
      ? linearScore(listing.commute.transferCount, 0, 3)
      : 50
  const ageScore = linearScore(listing.buildingAge, 0, 40)
  const amenityCount = AMENITY_KEYS.filter((k) => listing[k]).length
  const amenityScore = linearScore(amenityCount, 6, 0)

  const total =
    commuteScore * weights.commute +
    rentScore * weights.rent +
    areaScore * weights.area +
    stationScore * weights.stationWalk +
    transferScore * weights.transfers +
    ageScore * weights.buildingAge +
    amenityScore * weights.amenities

  const weightSum =
    weights.commute +
    weights.rent +
    weights.area +
    weights.stationWalk +
    weights.transfers +
    weights.buildingAge +
    weights.amenities

  const score = Math.round(total / weightSum)

  const reasons: string[] = []
  if (commuteMin != null && commuteScore >= 70)
    reasons.push(`通勤${commuteMin}分`)
  if (rentScore >= 70)
    reasons.push(`家賃が手頃 (¥${listing.monthlyRent.toLocaleString('ja-JP')})`)
  if (stationScore >= 70)
    reasons.push(`駅徒歩${listing.walkMinutesToStation}分`)
  if (areaScore >= 70) reasons.push(`広さ${listing.floorArea}m²`)
  if (ageScore >= 80) reasons.push(`築${listing.buildingAge}年`)
  if (amenityCount >= 5) reasons.push('設備が充実')

  return { score, reasons }
}
