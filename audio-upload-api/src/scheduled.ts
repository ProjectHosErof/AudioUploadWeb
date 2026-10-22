import { getSupabase } from './lib/supabase';
import { deleteObject, listRawObjects } from './storage/r2';
import { isSweepEnabled, maxSweepDeletions, planSweep } from './lib/sweepGuard';
import { sendReviewDigests } from './jobs/digest';

/**
 * Scheduled janitor (Cloudflare Cron Trigger). Keeps the DB and the R2 bucket
 * from drifting apart as uploads half-complete:
 *
 *  - reapStalePending: deletes `pending` rows whose presigned URL has long
 *    since expired (they can never complete).
 *  - sweepOrphanObjects: deletes R2 objects with no live DB row (a browser PUT
 *    that succeeded but whose /complete never fired). Guarded by
 *    src/lib/sweepGuard.ts: it deletes nothing when switched off, when the DB
 *    reports no completed uploads, or when a run would delete more than a few
 *    objects — the signatures of a wrong or restored database.
 *
 * Reap runs first so a just-reaped row's leftover object is then swept.
 */

// Reap/sweep anything older than this multiple of the presign TTL, so we never
// race an in-flight upload (URL valid for one TTL; 2× is a safe margin).
const TTL_MULTIPLIER = 2;

function cutoffMs(env: Env): number {
  return Date.now() - Number(env.PRESIGN_TTL_SECONDS) * TTL_MULTIPLIER * 1000;
}

async function reapStalePending(env: Env): Promise<number> {
  const cutoff = new Date(cutoffMs(env)).toISOString();
  const { data, error } = await getSupabase(env)
    .from('recordings')
    .delete()
    .eq('upload_status', 'pending')
    .lt('created_at', cutoff)
    .select('id');
  if (error) {
    console.error('reapStalePending failed', error);
    return 0;
  }
  return data?.length ?? 0;
}

async function sweepOrphanObjects(env: Env): Promise<number> {
  if (!isSweepEnabled(env.JANITOR_SWEEP_ENABLED)) {
    console.warn('janitor: sweep disabled (JANITOR_SWEEP_ENABLED)');
    return 0;
  }

  const cutoff = cutoffMs(env);
  const listed = await listRawObjects(env);
  const objects = listed.filter((o) => o.lastModified.getTime() < cutoff);
  if (objects.length === 0) return 0;

  const supabase = getSupabase(env);

  // How many uploads the DB believes are complete — the guard's check that
  // we're talking to the right, non-empty database.
  const completed = await supabase
    .from('recordings')
    .select('id', { count: 'exact', head: true })
    .eq('upload_status', 'completed');
  if (completed.error || completed.count === null) {
    console.error('sweepOrphanObjects count failed', completed.error);
    return 0;
  }

  const known = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < objects.length; i += CHUNK) {
    const slice = objects.slice(i, i + CHUNK).map((o) => o.key);
    const { data, error } = await supabase.from('recordings').select('r2_key').in('r2_key', slice);
    if (error) {
      // Don't delete blind if we can't confirm which keys are known.
      console.error('sweepOrphanObjects lookup failed', error);
      return 0;
    }
    for (const row of data ?? []) known.add(row.r2_key);
  }

  const plan = planSweep({
    candidates: objects.map((o) => o.key),
    knownKeys: known,
    completedCount: completed.count,
    totalListed: listed.length,
  });
  if (plan.action === 'abort') {
    // Deliberately deletes nothing: this is what a wrong or restored database
    // looks like. Investigate before re-running; see the restore runbook.
    console.error('janitor: sweep aborted', plan.reason, {
      orphans: plan.orphans,
      listed: listed.length,
      limit: maxSweepDeletions(listed.length),
    });
    return 0;
  }

  let deleted = 0;
  for (const key of plan.keys) {
    try {
      await deleteObject(env, key);
      deleted++;
    } catch (e) {
      console.error('sweep deleteObject failed', key, e);
    }
  }
  return deleted;
}

/** The daily digest trigger, as declared in wrangler.jsonc. */
const DIGEST_CRON = '0 16 * * *';

/**
 * Two schedules share this handler, so it dispatches on which one fired:
 *   every 15 min — the janitor
 *   16:00 UTC    — the review digest (noon US Eastern, early evening in Cairo,
 *                  which is a reasonable hour across most of the contributor
 *                  base; there is no per-contributor timezone to work from)
 */
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  if (controller.cron === DIGEST_CRON) {
    // A scheduled run has no request to read the Worker's own origin from, so
    // unlike the fetch path it has to be configured. API_ORIGIN falls back to
    // the deployed Worker URL.
    await sendReviewDigests(env, env.API_ORIGIN);
    return;
  }

  const reaped = await reapStalePending(env);
  const swept = await sweepOrphanObjects(env);
  console.log(`janitor: reaped ${reaped} stale pending row(s), swept ${swept} orphan object(s)`);
}
