import { useAppStore } from '../store/appStore'
import type { TravelMode } from './types'

/** Serializes current search conditions/filters into the URL query. */
export function syncStateToUrl(): void {
  const { company, conditions, filters, sortKey } = useAppStore.getState()
  const params = new URLSearchParams()
  if (company) {
    params.set('lat', String(company.lat))
    params.set('lng', String(company.lng))
    params.set('place', company.name)
  }
  params.set('mode', conditions.mode)
  params.set('max', String(conditions.maxMinutes))
  params.set('arrive', conditions.arrivalTime)
  params.set('sort', sortKey)
  if (filters.minRent != null) params.set('minRent', String(filters.minRent))
  if (filters.maxRent != null) params.set('maxRent', String(filters.maxRent))
  if (filters.minArea != null) params.set('minArea', String(filters.minArea))
  if (filters.maxArea != null) params.set('maxArea', String(filters.maxArea))
  if (filters.layouts?.length) params.set('layouts', filters.layouts.join(','))
  if (filters.maxBuildingAge != null)
    params.set('age', String(filters.maxBuildingAge))
  if (filters.maxStationWalk != null)
    params.set('stwalk', String(filters.maxStationWalk))
  window.history.replaceState(null, '', `?${params.toString()}`)
}

/** Restores conditions/filters from the URL query on page load. */
export function restoreStateFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const s = useAppStore.getState()
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  if (Number.isFinite(lat) && Number.isFinite(lng) && params.get('lat')) {
    s.setCompany({
      id: 'url_restore',
      name: params.get('place') ?? '保存した勤務地',
      address: '',
      placeType: 'map_point',
      prefecture: '',
      lat,
      lng,
      provider: 'cache',
    })
  }
  const mode = params.get('mode')
  if (mode) s.setConditions({ mode: mode as TravelMode })
  const max = Number(params.get('max'))
  if (Number.isFinite(max) && max > 0) s.setConditions({ maxMinutes: max })
  const arrive = params.get('arrive')
  if (arrive) s.setConditions({ arrivalTime: arrive })
  const numFilter = (key: string) => {
    const v = Number(params.get(key))
    return Number.isFinite(v) && params.get(key) ? v : undefined
  }
  s.setFilters({
    minRent: numFilter('minRent'),
    maxRent: numFilter('maxRent'),
    minArea: numFilter('minArea'),
    maxArea: numFilter('maxArea'),
    maxBuildingAge: numFilter('age'),
    maxStationWalk: numFilter('stwalk'),
    layouts: params.get('layouts')?.split(',').filter(Boolean),
  })
}
