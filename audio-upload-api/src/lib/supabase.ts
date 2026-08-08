import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Build a Supabase client scoped to a single request. Uses the service-role
 * key (server-side only — never exposed to the browser), so it bypasses RLS.
 * All authorization is enforced in the Worker.
 */
export function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch.bind(globalThis) },
  });
}
