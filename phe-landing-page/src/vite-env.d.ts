/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed audio-upload-api Worker (no trailing slash). */
  readonly VITE_API_BASE_URL?: string;
  /** Cloudflare Turnstile SITE key (public) paired with the Worker's TURNSTILE_SECRET. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Supabase project URL. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase ANON key (public). Never the service_role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
