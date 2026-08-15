import type { CommuteProvider, TravelMode } from '../lib/types'
import { DEMO_MODE, SUPABASE_ENABLED } from '../lib/config'
import { DemoTransitProvider } from './demoTransit'
import {
  NavitimeCommuteProvider,
  OpenRouteServiceProvider,
} from './edgeProvider'
import { CachedCommuteProvider } from './cached'

const demo = new CachedCommuteProvider(new DemoTransitProvider())
const navitime = new CachedCommuteProvider(NavitimeCommuteProvider())
const ors = new CachedCommuteProvider(OpenRouteServiceProvider())

export const cachedProviders = { demo, navitime, ors }

/**
 * Ordered provider chain for a mode. Edge-backed providers are only
 * attempted when Supabase is configured and demo mode is off; the demo
 * provider always terminates the chain so the app degrades gracefully
 * when API keys/quota are unavailable.
 */
export function providerChain(mode: TravelMode): CommuteProvider[] {
  const chain: CommuteProvider[] = []
  if (SUPABASE_ENABLED && !DEMO_MODE) {
    chain.push(navitime)
    if (ors.supportsMode(mode)) chain.push(ors)
  }
  chain.push(demo)
  return chain
}

/** Runs fn against each provider in the chain until one succeeds. */
export async function withFallback<T>(
  mode: TravelMode,
  fn: (p: CommuteProvider) => Promise<T>,
  onFallback?: (failed: string, next: string) => void,
): Promise<T> {
  const chain = providerChain(mode)
  let lastError: unknown = null
  for (let i = 0; i < chain.length; i++) {
    try {
      return await fn(chain[i])
    } catch (err) {
      lastError = err
      const next = chain[i + 1]
      if (next && onFallback) onFallback(chain[i].name, next.name)
    }
  }
  throw lastError
}
