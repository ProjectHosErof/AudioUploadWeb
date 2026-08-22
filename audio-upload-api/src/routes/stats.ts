import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';

export const stats = new Hono<{ Bindings: Env }>();

/**
 * Cache the aggregate briefly per isolate. These numbers are motivational, not
 * transactional, so a slightly stale value is fine and it keeps a public
 * endpoint from turning into a free way to hammer the database.
 */
const CACHE_TTL_MS = 60_000;
let cache: { data: CommunityStats; expiresAt: number } | null = null;

interface CommunityStats {
  /** Recordings that passed moderation and are part of the corpus. */
  readyRecordings: number;
  /** Every completed upload, regardless of review state. */
  totalRecordings: number;
  /** Summed duration of accepted recordings, in seconds. */
  readySeconds: number;
  /** Distinct signed-in contributors. Anonymous uploads aren't counted. */
  contributors: number;
}

/**
 * GET /stats/community — corpus-wide totals for the contributor dashboard
 * (ADR-006). This can't come through RLS, which deliberately scopes an
 * authenticated user to their own rows, so it runs on the Worker's
 * service_role. Public and aggregate-only: no per-recording data is exposed.
 */
stats.get('/community', async (c) => {
  if (cache && Date.now() < cache.expiresAt) {
    return c.json(cache.data);
  }

  const supabase = getSupabase(c.env);

  // `head: true` with an exact count returns the count without the rows.
  const [readyCount, totalCount, durations, contributorCount] = await Promise.all([
    supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'ready'),
    supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('upload_status', 'completed'),
    supabase
      .from('recordings')
      .select('duration_seconds')
      .eq('review_status', 'ready')
      .not('duration_seconds', 'is', null),
    supabase.from('contributors').select('id', { count: 'exact', head: true }),
  ]);

  const failure = readyCount.error ?? totalCount.error ?? durations.error ?? contributorCount.error;
  if (failure) {
    console.error('community stats failed', failure);
    return c.json({ error: 'Could not load community statistics.' }, 500);
  }

  // duration_seconds is numeric, which PostgREST serialises as a string.
  const readySeconds = (durations.data ?? []).reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0,
  );

  const data: CommunityStats = {
    readyRecordings: readyCount.count ?? 0,
    totalRecordings: totalCount.count ?? 0,
    readySeconds: Math.round(readySeconds),
    contributors: contributorCount.count ?? 0,
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return c.json(data);
});
