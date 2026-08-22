import type { Context } from 'hono';

/**
 * Run work that must not delay the response — sending mail, mostly.
 *
 * `waitUntil` keeps the isolate alive until the promise settles, so the work
 * still completes after the response has been returned. Two guards matter:
 * `c.executionCtx` throws when there is no execution context rather than
 * returning undefined, and an unhandled rejection inside background work is
 * invisible, so the promise is always given a catch.
 */
export function background(c: Context, work: Promise<unknown>): void {
  const guarded = work.catch((err) => {
    console.error('background work failed', err);
  });

  try {
    c.executionCtx.waitUntil(guarded);
  } catch {
    // No execution context (some test harnesses). The work is already running;
    // let it finish on its own rather than dropping it.
  }
}
