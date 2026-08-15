import { create } from 'zustand'
import type {
  CommuteConditions,
  IsochroneResult,
  ListingFilters,
  ListingWithCommute,
  PlaceCandidate,
  SortKey,
} from '../lib/types'
import type { Locale } from '../lib/i18n'
import { DEFAULT_ARRIVAL_TIME } from '../lib/config'

export interface DebugStats {
  provider: string
  apiCalls: number
  cacheHits: number
  cacheMisses: number
  phase: string
  prefilterCount: number
  isochroneCount: number
  verifiedCount: number
  finalCount: number
  elapsedMs: number
}

interface AppState {
  locale: Locale
  company: PlaceCandidate | null
  conditions: CommuteConditions
  filters: ListingFilters
  sortKey: SortKey
  results: ListingWithCommute[]
  isochrone: IsochroneResult | null
  searching: boolean
  searchError: string | null
  fallbackNotice: boolean
  selectedListingId: string | null
  hoveredListingId: string | null
  detailListingId: string | null
  favorites: string[]
  compareIds: string[]
  mapPickMode: boolean
  debug: DebugStats | null
  showDebug: boolean
  setLocale(locale: Locale): void
  setCompany(place: PlaceCandidate | null): void
  setConditions(c: Partial<CommuteConditions>): void
  setFilters(f: Partial<ListingFilters>): void
  resetFilters(): void
  setSortKey(k: SortKey): void
  setResults(r: ListingWithCommute[]): void
  setIsochrone(i: IsochroneResult | null): void
  setSearching(v: boolean): void
  setSearchError(e: string | null): void
  setFallbackNotice(v: boolean): void
  selectListing(id: string | null): void
  hoverListing(id: string | null): void
  openDetail(id: string | null): void
  toggleFavorite(id: string): void
  toggleCompare(id: string): void
  setMapPickMode(v: boolean): void
  setDebug(d: DebugStats | null): void
  toggleDebug(): void
}

const FAV_KEY = 'souseki_favorites'

function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  locale: 'ja',
  company: null,
  conditions: {
    mode: 'transit',
    maxMinutes: 30,
    arrivalTime: DEFAULT_ARRIVAL_TIME,
    maxTransfers: 3,
    allowBus: true,
    allowTollRoads: false,
    maxStationWalk: 20,
  },
  filters: {},
  sortKey: 'recommended',
  results: [],
  isochrone: null,
  searching: false,
  searchError: null,
  fallbackNotice: false,
  selectedListingId: null,
  hoveredListingId: null,
  detailListingId: null,
  favorites: loadFavorites(),
  compareIds: [],
  mapPickMode: false,
  debug: null,
  showDebug: false,
  setLocale: (locale) => set({ locale }),
  setCompany: (company) => set({ company }),
  setConditions: (c) =>
    set((s) => ({ conditions: { ...s.conditions, ...c } })),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),
  setSortKey: (sortKey) => set({ sortKey }),
  setResults: (results) => set({ results }),
  setIsochrone: (isochrone) => set({ isochrone }),
  setSearching: (searching) => set({ searching }),
  setSearchError: (searchError) => set({ searchError }),
  setFallbackNotice: (fallbackNotice) => set({ fallbackNotice }),
  selectListing: (selectedListingId) => set({ selectedListingId }),
  hoverListing: (hoveredListingId) => set({ hoveredListingId }),
  openDetail: (detailListingId) => set({ detailListingId }),
  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((f) => f !== id)
      : [...get().favorites, id]
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites))
    set({ favorites })
  },
  toggleCompare: (id) => {
    const cur = get().compareIds
    const compareIds = cur.includes(id)
      ? cur.filter((c) => c !== id)
      : cur.length >= 4
        ? cur
        : [...cur, id]
    set({ compareIds })
  },
  setMapPickMode: (mapPickMode) => set({ mapPickMode }),
  setDebug: (debug) => set({ debug }),
  toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
}))
