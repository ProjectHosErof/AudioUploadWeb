import { getSupabase } from './supabase';

/**
 * Controlled vocabulary (service/season/hymn/language slugs) cached per Worker
 * isolate. The reference tables are tiny and change rarely, so validating every
 * `initiate` with 4 DB round-trips is wasteful. We load them once per isolate
 * and refresh on a short TTL; the DB (and FK constraints) remain authoritative,
 * so a stale isolate at worst rejects a brand-new slug for up to TTL_MS.
 */
export interface Vocab {
  services: Set<string>;
  seasons: Set<string>;
  hymns: Map<string, string>; // slug -> label (for the snapshot at submit time)
  languages: Set<string>;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

let cache: { data: Vocab; expiresAt: number } | null = null;
// Coalesce concurrent misses so a cold isolate loads the vocab once, not N times.
let inflight: Promise<Vocab> | null = null;

async function load(env: Env): Promise<Vocab> {
  const supabase = getSupabase(env);
  const [services, seasons, hymns, languages] = await Promise.all([
    supabase.from('services').select('slug'),
    supabase.from('seasons').select('slug'),
    supabase.from('hymns').select('slug, label'),
    supabase.from('languages').select('slug'),
  ]);
  const err = services.error ?? seasons.error ?? hymns.error ?? languages.error;
  if (err) throw new Error(`vocab load failed: ${err.message}`);

  return {
    services: new Set((services.data ?? []).map((r) => r.slug as string)),
    seasons: new Set((seasons.data ?? []).map((r) => r.slug as string)),
    hymns: new Map((hymns.data ?? []).map((r) => [r.slug as string, r.label as string])),
    languages: new Set((languages.data ?? []).map((r) => r.slug as string)),
  };
}

export async function getVocab(env: Env): Promise<Vocab> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) return cache.data;
  if (inflight) return inflight;

  inflight = load(env)
    .then((data) => {
      cache = { data, expiresAt: Date.now() + TTL_MS };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
