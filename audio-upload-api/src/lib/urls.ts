import type { Context } from 'hono';

/**
 * Where links in outbound email should point.
 *
 * Two different origins are involved and mixing them up produces links that
 * 404 in somebody's inbox, which is not a failure you find in testing:
 *   - the SITE  is the frontend, where a human lands (dashboard, upload form),
 *   - the API   is this Worker, where confirm/unsubscribe links resolve.
 */

/** The frontend origin. Falls back to the first configured CORS origin. */
export function siteUrl(env: Env): string {
  const configured = env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return env.ALLOWED_ORIGINS.split(',')[0].trim().replace(/\/$/, '');
}

/**
 * This Worker's own origin, taken from the request rather than configured —
 * it is correct in local dev, on workers.dev, and on a custom domain without
 * anyone having to remember to update a variable.
 */
export function apiUrl(c: Context): string {
  return new URL(c.req.url).origin;
}
