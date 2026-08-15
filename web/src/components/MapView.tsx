import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
type MlMap = maplibregl.Map
import { useAppStore } from '../store/appStore'
import { GSI_ATTRIBUTION, GSI_TILE_URL } from '../lib/config'
import { setupMaplibre } from '../lib/maplibre'
import { formatMinutes, formatRentShort, formatYen } from '../lib/format'
import { t } from '../lib/i18n'
import type { Locale } from '../lib/i18n'
import type { ListingWithCommute } from '../lib/types'

const LISTING_COLOR = '#dc2626'
const FAVORITE_COLOR = '#eab308'

const PILL_CLASS =
  'cursor-pointer rounded-full border-2 border-white px-1.5 py-0.5 text-[11px] leading-none font-bold text-white shadow transition-transform'

/** Rent shown on the map pill in 万円 units, e.g. 85000 -> "8.5万". */
export function rentPillLabel(yen: number): string {
  const man = yen / 10000
  return `${Number.isInteger(man) ? man : man.toFixed(1)}万`
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

/** Compact key facts shown in the map popup of a listing. */
function popupHtml(listing: ListingWithCommute, locale: Locale): string {
  const commute = listing.commute
  const rows = [
    `${listing.layout}・${listing.floorArea}m²・${t(locale, 'buildingAge')}${listing.buildingAge}`,
    `${listing.nearestStationName}・${t(locale, 'stationWalk')}${listing.walkMinutesToStation}分`,
    commute
      ? `${t(locale, 'commuteTime')} ${formatMinutes(commute.durationMinutes)}・${t(locale, 'transfers')}${commute.transferCount}${
          commute.isEstimated ? `（${t(locale, 'estimated')}）` : ''
        }`
      : null,
  ].filter((r): r is string => r != null)
  return `<div style="min-width:11rem">
    <div style="font-weight:600;font-size:0.875rem">${escapeHtml(listing.title)}</div>
    <div style="font-weight:700;font-size:1rem;color:#4338ca;margin:2px 0 4px">${escapeHtml(
      formatYen(listing.monthlyRent),
    )}</div>
    ${rows
      .map(
        (r) =>
          `<div style="font-size:0.75rem;color:#4b5563">${escapeHtml(r)}</div>`,
      )
      .join('')}
  </div>`
}

/** Route line of the selected listing, split into walk / transit parts. */
function routeToGeoJSON(listing: ListingWithCommute | undefined): FeatureCollection {
  const shape = listing?.commute?.shape
  if (!shape) return { type: 'FeatureCollection', features: [] }
  const lines = (
    [
      ['walk', shape.walk],
      ['transit', shape.transit],
    ] as const
  ).flatMap(([kind, parts]) =>
    (parts ?? []).map((coordinates) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates },
      properties: { kind },
    })),
  )
  return { type: 'FeatureCollection', features: lines }
}

export function MapView() {
  const mapRef = useRef<MlMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const companyMarkerRef = useRef<maplibregl.Marker | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null)
  const selectedPopupRef = useRef<maplibregl.Popup | null>(null)
  const {
    locale,
    results,
    isochrone,
    company,
    favorites,
    selectedListingId,
    hoveredListingId,
    selectListing,
    hoverListing,
    openDetail,
    mapPickMode,
    setMapPickMode,
    setCompany,
  } = useAppStore()

  // Marker handlers are registered once per render, so read the latest locale via a ref.
  const localeRef = useRef(locale)
  localeRef.current = locale

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    setupMaplibre()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: 'raster',
            tiles: [GSI_TILE_URL],
            tileSize: 256,
            attribution: GSI_ATTRIBUTION,
          },
        },
        layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
      },
      center: [139.7006, 35.6896],
      zoom: 12,
      attributionControl: { compact: false },
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('error', (e) => console.error('maplibre', e.error?.message ?? e))
    map.on('load', () => {
      map.addSource('isochrone', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'isochrone-fill',
        type: 'fill',
        source: 'isochrone',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: 'isochrone-line',
        type: 'line',
        source: 'isochrone',
        paint: { 'line-color': '#3b82f6', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      })
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // White casing keeps the route readable on the busy GSI basemap.
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'route-transit',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'transit'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 5,
          'line-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'route-walk',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'walk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0f172a',
          'line-width': 4,
          'line-dasharray': [1.4, 1.1],
        },
      })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      selectedPopupRef.current = null
      hoverPopupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Map-pick mode: click map to set company location.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapPickMode) return
    map.getCanvas().style.cursor = 'crosshair'
    const handler = (e: maplibregl.MapMouseEvent) => {
      setCompany({
        id: `map_${Date.now()}`,
        name: `地図選択地点 (${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)})`,
        address: '地図上で選択した地点',
        placeType: 'map_point',
        prefecture: '',
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        provider: 'demo',
      })
      setMapPickMode(false)
    }
    map.once('click', handler)
    return () => {
      map.off('click', handler)
      map.getCanvas().style.cursor = ''
    }
  }, [mapPickMode, setCompany, setMapPickMode])

  // Listing markers: rent pills (万円) that are always visible and clickable.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of markersRef.current.values()) m.remove()
    markersRef.current.clear()
    for (const l of results) {
      const el = document.createElement('div')
      el.className = PILL_CLASS
      el.style.backgroundColor = favorites.includes(l.id)
        ? FAVORITE_COLOR
        : LISTING_COLOR
      el.textContent = rentPillLabel(l.monthlyRent)
      el.title = `${l.title} / ${formatRentShort(l.monthlyRent)}`
      el.addEventListener('click', () => {
        selectListing(l.id)
        openDetail(l.id)
      })
      el.addEventListener('mouseenter', () => {
        hoverListing(l.id)
        if (l.id === selectedListingId) return
        hoverPopupRef.current ??= new maplibregl.Popup({
          closeButton: false,
          offset: 16,
        })
        hoverPopupRef.current
          .setLngLat([l.lng, l.lat])
          .setHTML(popupHtml(l, localeRef.current))
          .addTo(map)
      })
      el.addEventListener('mouseleave', () => {
        hoverListing(null)
        hoverPopupRef.current?.remove()
      })
      markersRef.current.set(
        l.id,
        new maplibregl.Marker({ element: el })
          .setLngLat([l.lng, l.lat])
          .addTo(map),
      )
    }
    return () => {
      for (const m of markersRef.current.values()) m.remove()
      markersRef.current.clear()
      hoverPopupRef.current?.remove()
    }
  }, [
    results,
    favorites,
    selectListing,
    openDetail,
    hoverListing,
    selectedListingId,
  ])

  // Draw the selected listing's route line.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const source = map.getSource('route') as
        | maplibregl.GeoJSONSource
        | undefined
      source?.setData(
        routeToGeoJSON(results.find((l) => l.id === selectedListingId)),
      )
    }
    if (map.getSource('route')) apply()
    else map.once('load', apply)
  }, [selectedListingId, results])

  // Update isochrone.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const source = map.getSource('isochrone') as
        | maplibregl.GeoJSONSource
        | undefined
      source?.setData(
        isochrone
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: isochrone.polygon,
                  properties: {},
                },
              ],
            }
          : { type: 'FeatureCollection', features: [] },
      )
    }
    if (map.getSource('isochrone')) apply()
    else map.once('load', apply)
  }, [isochrone])

  // Company marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    companyMarkerRef.current?.remove()
    companyMarkerRef.current = null
    if (company) {
      const marker = new maplibregl.Marker({ color: '#7c3aed' })
        .setLngLat([company.lng, company.lat])
        .setPopup(new maplibregl.Popup().setText(company.name))
        .addTo(map)
      companyMarkerRef.current = marker
      map.flyTo({ center: [company.lng, company.lat], zoom: 13 })
    }
  }, [company])

  // Show the selected listing: fit the whole route when one is available.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedListingId) return
    const listing = results.find((l) => l.id === selectedListingId)
    if (!listing) return
    const shape = listing.commute?.shape
    const points = [...(shape?.walk ?? []), ...(shape?.transit ?? [])].flat()
    if (points.length) {
      const bounds = new maplibregl.LngLatBounds(
        [points[0][0], points[0][1]],
        [points[0][0], points[0][1]],
      )
      for (const p of points) bounds.extend([p[0], p[1]])
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 })
    } else {
      map.flyTo({ center: [listing.lng, listing.lat], zoom: 15 })
    }
  }, [selectedListingId, results])

  // Keep a key-facts popup pinned on the selected listing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const listing = results.find((l) => l.id === selectedListingId)
    if (!listing) {
      selectedPopupRef.current?.remove()
      return
    }
    selectedPopupRef.current ??= new maplibregl.Popup({
      closeButton: true,
      offset: 16,
      closeOnClick: false,
    })
    selectedPopupRef.current
      .setLngLat([listing.lng, listing.lat])
      .setHTML(popupHtml(listing, locale))
      .addTo(map)
  }, [selectedListingId, results, locale])

  // Highlight hovered / selected listing pills.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const active = id === hoveredListingId || id === selectedListingId
      const el = marker.getElement()
      el.style.zIndex = active ? '2' : '1'
      el.style.scale = active ? '1.25' : '1'
      el.style.outline = id === selectedListingId ? '2px solid #1d4ed8' : ''
      el.style.outlineOffset = '1px'
    }
  }, [hoveredListingId, selectedListingId, results, favorites])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {mapPickMode && (
        <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white shadow">
          {t(locale, 'selectOnMap')}…
        </div>
      )}
      <MapLegend />
    </div>
  )
}

function MapLegend() {
  const { locale, isochrone, conditions } = useAppStore()
  return (
    <div className="absolute bottom-6 left-3 z-10 rounded-lg bg-white/90 p-3 text-xs shadow">
      <div className="mb-1 font-semibold">
        {isochrone?.isEstimated
          ? t(locale, 'searchArea')
          : t(locale, 'isochroneArea')}
        {isochrone?.isEstimated && (
          <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">
            {t(locale, 'estimated')}
          </span>
        )}
      </div>
      <div className="text-gray-600">
        {t(locale, `mode_${conditions.mode}` as 'mode_transit')} ≤{' '}
        {conditions.maxMinutes}分
        {isochrone && (
          <>
            <br />
            {t(locale, 'dataSource')}: {isochrone.provider}
          </>
        )}
      </div>
      <div className="mt-2 space-y-1 text-gray-600">
        <div className="flex items-center gap-1">
          <span
            className="inline-block rounded-full border border-white px-1 text-[10px] leading-tight font-bold text-white"
            style={{ backgroundColor: LISTING_COLOR }}
          >
            8.5万
          </span>
          {t(locale, 'listingPoint')}
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-5"
            style={{ backgroundColor: '#1d4ed8' }}
          />
          {t(locale, 'routeTransitLine')}
          <span
            className="ml-2 inline-block h-0.5 w-5 border-t-2 border-dashed"
            style={{ borderColor: '#475569' }}
          />
          {t(locale, 'routeWalkLine')}
        </div>
      </div>
    </div>
  )
}
