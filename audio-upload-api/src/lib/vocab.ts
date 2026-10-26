import { getSupabase } from './supabase';

/**
 * Controlled vocabulary (service/season/hymn/language slugs, plus which hymns
 * belong to which season + service) cached per Worker isolate. The reference
 * tables are small and change rarely, so validating every `initiate` with DB
 * round-trips is wasteful. We load them once per isolate and refresh on a short
 * TTL; the DB (and FK constraints) remain authoritative, so a stale isolate at
 * worst rejects a brand-new slug for up to TTL_MS.
 */
export interface Vocab {
  services: Set<string>;
  seasons: Set<string>;
  hymns: Map<string, string>; // slug -> label (for the snapshot at submit time)
  retiredHymns: Set<string>; // kept for old recordings, refused for new ones
  languages: Set<string>;
  hymnsByPair: Map<string, Set<string>>; // "season|service" -> hymn slugs
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
// PostgREST caps a response at 1,000 rows by default; placements exceed that.
const PAGE = 1000;

let cache: { data: Vocab; expiresAt: number } | null = null;
// Coalesce concurrent misses so a cold isolate loads the vocab once, not N times.
let inflight: Promise<Vocab> | null = null;

type Placement = { hymn_slug: string; season_slug: string; service_slug: string };
type HymnRow = { slug: string; label: string; is_active: boolean };

/** Read every row of a table, a page at a time, in a stable order. */
async function fetchAll<T>(env: Env, table: string, columns: string, orderBy: string[]): Promise<T[]> {
  const supabase = getSupabase(env);
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns);
    for (const col of orderBy) query = query.order(col);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`vocab load failed: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function load(env: Env): Promise<Vocab> {
  const supabase = getSupabase(env);
  const [services, seasons, hymns, languages, placements] = await Promise.all([
    supabase.from('services').select('slug'),
    supabase.from('seasons').select('slug'),
    fetchAll<HymnRow>(env, 'hymns', 'slug, label, is_active', ['slug']),
    supabase.from('languages').select('slug'),
    fetchAll<Placement>(env, 'hymn_placements', 'hymn_slug, season_slug, service_slug', [
      'hymn_slug',
      'season_slug',
      'service_slug',
    ]),
  ]);
  const err = services.error ?? seasons.error ?? languages.error;
  if (err) throw new Error(`vocab load failed: ${err.message}`);

  const hymnsByPair = new Map<string, Set<string>>();
  for (const p of placements) {
    const key = `${p.season_slug}|${p.service_slug}`;
    if (!hymnsByPair.has(key)) hymnsByPair.set(key, new Set());
    hymnsByPair.get(key)!.add(p.hymn_slug);
  }

  return {
    services: new Set((services.data ?? []).map((r) => r.slug as string)),
    seasons: new Set((seasons.data ?? []).map((r) => r.slug as string)),
    hymns: new Map(hymns.map((r) => [r.slug, r.label])),
    retiredHymns: new Set(hymns.filter((r) => r.is_active === false).map((r) => r.slug)),
    languages: new Set((languages.data ?? []).map((r) => r.slug as string)),
    hymnsByPair,
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
