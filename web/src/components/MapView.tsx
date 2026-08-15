import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
type MlMap = maplibregl.Map
import { useAppStore } from '../store/appStore'
import { GSI_ATTRIBUTION, GSI_TILE_URL } from '../lib/config'
import { formatMinutes, formatRentShort, formatYen } from '../lib/format'
import { t } from '../lib/i18n'
import type { Locale } from '../lib/i18n'
import type { ListingWithCommute } from '../lib/types'

// maplibre-gl resolves its worker relative to its own module URL, which does not
// exist once the library is bundled; point it at the emitted worker asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

function commuteColor(minutes: number | undefined): string {
  if (minutes == null) return '#6b7280'
  if (minutes <= 20) return '#16a34a'
  if (minutes <= 30) return '#84cc16'
  if (minutes <= 45) return '#f97316'
  return '#dc2626'
}

function listingsToGeoJSON(
  results: ListingWithCommute[],
  favorites: string[],
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: results.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        rent: formatRentShort(l.monthlyRent),
        color: favorites.includes(l.id)
          ? '#eab308'
          : commuteColor(l.commute?.durationMinutes),
      },
    })),
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

/** Compact key facts shown in the map popup of the selected listing. */
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

/**
 * Runs `apply` once the map's data layers exist. `map.isStyleLoaded()` is false
 * while raster tiles are still loading, so it cannot be used as the readiness
 * signal: the `load` event may already have fired and never fire again.
 */
function whenLayersReady(map: MlMap, apply: () => void): void {
  if (map.getLayer('listing-points')) apply()
  else map.once('load', apply)
}

export function MapView() {
  const mapRef = useRef<MlMap | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const companyMarkerRef = useRef<maplibregl.Marker | null>(null)
  const {
    locale,
    results,
    isochrone,
    company,
    favorites,
    selectedListingId,
    hoveredListingId,
    selectListing,
    openDetail,
    mapPickMode,
    setMapPickMode,
    setCompany,
  } = useAppStore()

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
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
      map.addSource('listings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#6366f1',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
          'circle-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'listings',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'listing-points',
        type: 'circle',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: 'listing-rent',
        type: 'symbol',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'rent'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      })
      map.on('click', 'clusters', async (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        })
        const clusterId = features[0]?.properties?.cluster_id
        const source = map.getSource('listings') as maplibregl.GeoJSONSource
        if (clusterId != null) {
          const zoom = await source.getClusterExpansionZoom(clusterId)
          map.easeTo({
            center: (features[0].geometry as Point)
              .coordinates as [number, number],
            zoom,
          })
        }
      })
      map.on('click', 'listing-points', (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) {
          selectListing(id)
          openDetail(id)
        }
      })
      map.on('mouseenter', 'listing-points', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'listing-points', () => {
        map.getCanvas().style.cursor = ''
      })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
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

  // Update listings source.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    whenLayersReady(map, () => {
      const source = map.getSource('listings') as
        | maplibregl.GeoJSONSource
        | undefined
      source?.setData(listingsToGeoJSON(results, favorites))
    })
  }, [results, favorites])

  // Update isochrone.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    whenLayersReady(map, () => {
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
    })
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

  // Fly to selected listing.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedListingId) return
    const listing = results.find((l) => l.id === selectedListingId)
    if (listing) {
      map.flyTo({ center: [listing.lng, listing.lat], zoom: 15 })
    }
  }, [selectedListingId, results])

  // Highlight the selected / hovered listing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    whenLayersReady(map, () => {
      const selected = selectedListingId ?? ''
      map.setPaintProperty('listing-points', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], selected],
        14,
        ['==', ['get', 'id'], hoveredListingId ?? ''],
        12,
        8,
      ])
      map.setPaintProperty('listing-points', 'circle-stroke-color', [
        'case',
        ['==', ['get', 'id'], selected],
        '#1f2937',
        '#ffffff',
      ])
      map.setPaintProperty('listing-points', 'circle-stroke-width', [
        'case',
        ['==', ['get', 'id'], selected],
        3,
        2,
      ])
    })
  }, [hoveredListingId, selectedListingId])

  // Key facts popup for the selected listing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const listing = results.find((l) => l.id === selectedListingId)
    if (!listing) {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    const popup =
      popupRef.current ??
      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 14,
        maxWidth: '280px',
      })
    popup
      .setLngLat([listing.lng, listing.lat])
      .setHTML(popupHtml(listing, locale))
      .addTo(map)
    popupRef.current = popup
  }, [selectedListingId, results, locale])

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
      <div className="mt-2 flex items-center gap-2">
        {[
          ['#16a34a', '≤20分'],
          ['#84cc16', '≤30分'],
          ['#f97316', '≤45分'],
          ['#dc2626', '≤60分'],
        ].map(([c, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: c }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
