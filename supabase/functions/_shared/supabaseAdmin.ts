import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Service-role client used only inside Edge Functions to read/write
 * the third-party API caches. Never expose these keys to the browser.
 */
export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key)
}
