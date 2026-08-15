import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  SUPABASE_ENABLED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './config'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  }
  return client
}

export interface EdgeError {
  code: string
  message: string
}

/** Invokes a Supabase Edge Function; throws EdgeError-shaped errors. */
export async function invokeEdge<T>(
  name: string,
  body: unknown,
): Promise<T> {
  const sb = getSupabase()
  if (!sb) {
    throw { code: 'supabase_disabled', message: 'Supabase is not configured' }
  }
  const { data, error } = await sb.functions.invoke(name, {
    body: body as Record<string, unknown>,
  })
  if (error) {
    throw { code: 'edge_error', message: error.message ?? String(error) }
  }
  return data as T
}
