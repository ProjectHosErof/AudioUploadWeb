/**
 * Safety rails for the janitor's orphan sweep (see src/scheduled.ts).
 *
 * The sweep deletes R2 objects that have no matching `recordings` row. That is
 * right for a browser PUT whose /complete never fired, and catastrophic when
 * the *database* is what's wrong: restore last night's dump and every upload
 * since then looks orphaned; point the Worker at an empty or wrong Supabase
 * project and the entire corpus does. Audio can't be recreated, so the sweep
 * refuses to act whenever the picture looks like a DB problem rather than a
 * few stray uploads (ADR-012).
 *
 * Kept pure — no R2, no Supabase — so the decision is unit-testable.
 */

/** Real orphans trickle in one or two at a time; a batch bigger than this is a DB problem. */
export const SWEEP_FLOOR = 5;
export const SWEEP_FRACTION = 0.02;

export type SweepAbortReason = 'disabled' | 'db-empty' | 'blast-radius';

export type SweepPlan =
  | { action: 'delete'; keys: string[] }
  | { action: 'abort'; reason: SweepAbortReason; orphans: number };

/**
 * The kill switch. Only the exact string "true" enables the sweep, so a
 * missing or mistyped var fails safe. The restore runbook turns it off first.
 */
export function isSweepEnabled(value: string | undefined): boolean {
  return value === 'true';
}

/** Most objects one run may delete: max(5, 2% of everything listed). */
export function maxSweepDeletions(totalListed: number): number {
  return Math.max(SWEEP_FLOOR, Math.ceil(totalListed * SWEEP_FRACTION));
}

export function planSweep(input: {
  /** Keys old enough to sweep (past the presign cutoff). */
  candidates: string[];
  /** Candidate keys the DB has a row for. */
  knownKeys: Set<string>;
  /** `recordings` rows with upload_status = 'completed'. */
  completedCount: number;
  /** Every object under raw/, regardless of age — the denominator for the cap. */
  totalListed: number;
}): SweepPlan {
  const orphans = input.candidates.filter((key) => !input.knownKeys.has(key));

  // A bucket full of audio and a DB with no completed uploads is never real:
  // the Worker is reading the wrong or an empty database.
  if (input.completedCount === 0 && input.totalListed > 0) {
    return { action: 'abort', reason: 'db-empty', orphans: orphans.length };
  }
  if (orphans.length > maxSweepDeletions(input.totalListed)) {
    return { action: 'abort', reason: 'blast-radius', orphans: orphans.length };
  }
  return { action: 'delete', keys: orphans };
}
