import type { Polygon, MultiPolygon } from 'geojson'
import type { LatLng } from './types'

function inRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInPolygon(
  p: LatLng,
  polygon: Polygon | MultiPolygon,
): boolean {
  const pt: [number, number] = [p.lng, p.lat]
  const polys =
    polygon.type === 'Polygon' ? [polygon.coordinates] : polygon.coordinates
  for (const rings of polys) {
    if (rings.length === 0) continue
    if (!inRing(pt, rings[0] as [number, number][])) continue
    let inHole = false
    for (let i = 1; i < rings.length; i++) {
      if (inRing(pt, rings[i] as [number, number][])) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}
