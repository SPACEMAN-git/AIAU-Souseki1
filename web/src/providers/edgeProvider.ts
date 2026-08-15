import type {
  BatchRouteInput,
  CommuteProvider,
  IsochroneInput,
  IsochroneResult,
  PlaceCandidate,
  ProviderName,
  RouteInput,
  RouteResult,
  TravelMode,
} from '../lib/types'
import { invokeEdge } from '../lib/supabase'

/**
 * Provider backed by Supabase Edge Functions. The edge functions hold
 * the third-party API keys (NAVITIME / OpenRouteService / geocoders),
 * apply caching and rate limiting server-side, and never expose keys
 * to the browser.
 */
export class EdgeCommuteProvider implements CommuteProvider {
  readonly name: ProviderName
  private readonly modes: TravelMode[]

  constructor(name: ProviderName, modes: TravelMode[]) {
    this.name = name
    this.modes = modes
  }

  supportsMode(mode: TravelMode): boolean {
    return this.modes.includes(mode)
  }

  async geocodePlace(query: string): Promise<PlaceCandidate[]> {
    const res = await invokeEdge<{ candidates: PlaceCandidate[] }>(
      'geocode-place',
      { query },
    )
    return res.candidates
  }

  async calculateRoute(input: RouteInput): Promise<RouteResult> {
    const res = await invokeEdge<{ route: RouteResult }>('calculate-route', {
      ...input,
      provider: this.name,
    })
    return res.route
  }

  async calculateBatchRoutes(
    input: BatchRouteInput,
  ): Promise<Array<RouteResult & { id: string }>> {
    const res = await invokeEdge<{
      routes: Array<RouteResult & { id: string }>
    }>('calculate-commute-batch', { ...input, provider: this.name })
    return res.routes
  }

  async calculateIsochrone(input: IsochroneInput): Promise<IsochroneResult> {
    const res = await invokeEdge<{ isochrone: IsochroneResult }>(
      'calculate-isochrone',
      { ...input, provider: this.name },
    )
    return res.isochrone
  }
}

export const NavitimeCommuteProvider = () =>
  new EdgeCommuteProvider('navitime', [
    'transit',
    'walk_transit',
    'car',
    'bicycle',
    'walk',
  ])

export const OpenRouteServiceProvider = () =>
  new EdgeCommuteProvider('openrouteservice', ['walk', 'bicycle', 'car'])
