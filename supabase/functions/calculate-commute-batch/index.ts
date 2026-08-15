import { handleOptions, jsonResponse } from '../_shared/cors.ts'

/**
 * Batch commute verification endpoint. Intentionally does NOT fan out
 * one third-party API call per listing: real deployments should use a
 * NAVITIME batch/reachable-area contract endpoint here. Without a key
 * it returns 503 so the frontend uses the demo estimator instead.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = (await req.json()) as {
      origins?: Array<{ id: string; lat: number; lng: number }>
      destination?: { lat: number; lng: number }
      mode?: string
    }
    if (!body?.origins?.length || !body.destination) {
      return jsonResponse({ error: 'invalid body' }, 400)
    }
    const navitimeKey = Deno.env.get('NAVITIME_API_KEY')
    if (!navitimeKey) {
      return jsonResponse({ error: 'provider_unavailable' }, 503)
    }
    // NAVITIME batch integration point (contract endpoint).
    return jsonResponse({ error: 'provider_unavailable' }, 503)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
