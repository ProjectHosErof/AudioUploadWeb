import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

/**
 * Browser Supabase client, used for authentication and for reading the signed-in
 * contributor's own rows. It carries the public ANON key — Row-Level Security
 * (migration 0003) is what restricts access, not secrecy of this key.
 *
 * The library is loaded on demand: most visitors never sign in, and it is the
 * largest dependency on the page. `getSupabase()` resolves to null when
 * Supabase isn't configured, so the app still builds and the landing page
 * still works without auth credentials present.
 */

/**
 * Where supabase-js keeps the session. This is the library's own default
 * (`sb-<first label of the project host>-auth-token`), set explicitly so the
 * stored-session check below can't drift from it.
 */
const STORAGE_KEY = AUTH_ENABLED
  ? `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`
  : "";

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!AUTH_ENABLED) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // Required so the OAuth/magic-link redirect back into the app is parsed.
        detectSessionInUrl: true,
      },
    }),
  );
  return clientPromise;
}

/**
 * True when there may be a session to restore: one saved by an earlier visit,
 * or a sign-in redirect (OAuth or magic link) landing on this page. When
 * false, the visitor is certainly signed out and the library needn't load.
 */
export function hasStoredSessionOrAuthRedirect(): boolean {
  if (!AUTH_ENABLED) return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return true;
  } catch {
    // Storage blocked (private mode, policy): fall through to the URL check.
  }
  const { search, hash } = window.location;
  return /[?&#](code|access_token|error_description)=/.test(`${search}${hash}`);
}
