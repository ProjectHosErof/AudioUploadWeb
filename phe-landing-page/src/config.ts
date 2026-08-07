/**
 * Runtime config sourced from Vite env vars (see .env.example).
 * Both values are public: the API base URL and the Turnstile *site* key.
 */

// Default to the deployed Worker; override with VITE_API_BASE_URL for local dev.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "https://audio-upload-api.dev-anthonyriad.workers.dev"
).replace(/\/$/, "");

// Public Turnstile site key. Empty string until configured — the form guards on it.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
