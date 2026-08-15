import type { Polygon, MultiPolygon, LineString } from 'geojson'

export type TravelMode =
  | 'transit'
  | 'walk_transit'
  | 'car'
  | 'bicycle'
  | 'walk'

export type ProviderName =
  | 'navitime'
  | 'openrouteservice'
  | 'demo'
  | 'cache'
  | 'gsi'
  | 'geolonia'

export interface LatLng {
  lat: number
  lng: number
}

export interface PlaceCandidate {
  id: string
  name: string
  address: string
  placeType: 'company' | 'station' | 'address' | 'poi' | 'map_point'
  prefecture: string
  lat: number
  lng: number
  provider: ProviderName
}

export interface RouteLeg {
  kind: 'walk' | 'train' | 'bus' | 'car' | 'bicycle' | 'wait' | 'transfer'
  minutes: number
  lineName?: string
  fromName?: string
  toName?: string
}

export interface RouteResult {
  durationMinutes: number
  walkingMinutes: number
  transferCount: number
  estimatedCostYen: number | null
  legs: RouteLeg[]
  summary: string
  provider: ProviderName
  isEstimated: boolean
  computedAt: string
  geometry?: LineString
}

export interface RouteInput {
  origin: LatLng
  destination: LatLng
  mode: TravelMode
  arrivalTime?: string
  maxTransfers?: number
  allowBus?: boolean
  allowTollRoads?: boolean
}

export interface BatchRouteInput {
  origins: Array<LatLng & { id: string }>
  destination: LatLng
  mode: TravelMode
  arrivalTime?: string
}

export interface IsochroneInput {
  center: LatLng
  mode: TravelMode
  timeLimitMinutes: number
  arrivalTime?: string
}

export interface IsochroneResult {
  polygon: Polygon | MultiPolygon
  provider: ProviderName
  isEstimated: boolean
  computedAt: string
}

export interface CommuteProvider {
  readonly name: ProviderName
  supportsMode(mode: TravelMode): boolean
  geocodePlace(query: string): Promise<PlaceCandidate[]>
  calculateRoute(input: RouteInput): Promise<RouteResult>
  calculateBatchRoutes(
    input: BatchRouteInput,
  ): Promise<Array<RouteResult & { id: string }>>
  calculateIsochrone(input: IsochroneInput): Promise<IsochroneResult>
}

export interface Listing {
  id: string
  externalId: string
  title: string
  description: string
  propertyName: string
  address: string
  prefecture: string
  city: string
  district: string
  lat: number
  lng: number
  monthlyRent: number
  managementFee: number
  deposit: number
  keyMoney: number
  layout: string
  floorArea: number
  buildingAge: number
  builtYear: number
  floorNumber: number
  totalFloors: number
  structureType: string
  nearestStationName: string
  walkMinutesToStation: number
  railwayLine: string
  imageUrls: string[]
  sourceName: string
  sourceUrl: string
  isAvailable: boolean
  petsAllowed: boolean
  furnished: boolean
  bathToiletSeparate: boolean
  autoLock: boolean
  deliveryBox: boolean
  parkingAvailable: boolean
  bicycleParking: boolean
  internetFree: boolean
  airConditioner: boolean
  balcony: boolean
  isDemo: boolean
  updatedAt: string
}

export interface ListingWithCommute extends Listing {
  commute?: RouteResult
  distanceKm?: number
  score?: number
  scoreReasons?: string[]
}

export interface ListingFilters {
  minRent?: number
  maxRent?: number
  minArea?: number
  maxArea?: number
  layouts?: string[]
  maxBuildingAge?: number
  maxStationWalk?: number
  petsAllowed?: boolean
  furnished?: boolean
  bathToiletSeparate?: boolean
  autoLock?: boolean
  deliveryBox?: boolean
  parkingAvailable?: boolean
  bicycleParking?: boolean
  internetFree?: boolean
}

export type SortKey =
  | 'recommended'
  | 'commute'
  | 'rent_asc'
  | 'area_desc'
  | 'station_walk'
  | 'newest_building'
  | 'initial_cost'
  | 'updated'

export interface CommuteConditions {
  mode: TravelMode
  maxMinutes: number
  arrivalTime: string
  maxTransfers: number
  allowBus: boolean
  allowTollRoads: boolean
  maxStationWalk: number
}

export interface Station {
  id: string
  name: string
  operator: string
  line: string
  lat: number
  lng: number
}

export interface StationEdge {
  from: string
  to: string
  minutes: number
  line: string
  transfer: boolean
}
