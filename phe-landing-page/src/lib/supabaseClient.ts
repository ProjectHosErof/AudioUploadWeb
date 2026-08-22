import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

/**
 * Browser Supabase client, used for authentication and for reading the signed-in
 * contributor's own rows. It carries the public ANON key — Row-Level Security
 * (migration 0003) is what restricts access, not secrecy of this key.
 *
 * Null when Supabase isn't configured, so the app still builds and the landing
 * page still works without auth credentials present.
 */
export const supabase: SupabaseClient | null = AUTH_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Required so the OAuth/magic-link redirect back into the app is parsed.
        detectSessionInUrl: true,
      },
    })
  : null;

/** Narrowing helper for the places that require a configured client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
