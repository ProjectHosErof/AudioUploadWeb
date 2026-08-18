/**
 * Runtime config sourced from Vite env vars (see .env.example).
 * Every value here is public and safe to ship in the browser bundle.
 */

// Default to the deployed Worker; override with VITE_API_BASE_URL for local dev.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "https://audio-upload-api.dev-anthonyriad.workers.dev"
).replace(/\/$/, "");

// Public Turnstile site key. Empty string until configured — the form guards on it.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

// Supabase project URL + ANON key. The anon key is public by design; Row-Level
// Security (migration 0003) is what actually protects contributor data.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** Auth is only usable once both Supabase values are configured. */
export const AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
