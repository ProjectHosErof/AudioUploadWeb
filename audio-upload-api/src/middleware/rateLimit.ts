import type { MiddlewareHandler } from 'hono';

/** Client IP used as the rate-limit key. */
function clientIp(headerLookup: (name: string) => string | undefined): string {
  return (
    headerLookup('cf-connecting-ip') ??
    headerLookup('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * IP-based rate limiting backed by Cloudflare's native rate-limit binding
 * (`env.RATE_LIMITER`), enforced across all isolates at the edge — unlike a
 * per-isolate in-memory counter, which each isolate resets independently.
 * The limit/period are configured on the `ratelimit` binding in wrangler.jsonc.
 */
export function rateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = clientIp((n) => c.req.header(n));
    const { success } = await c.env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return c.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        429,
      );
    }
    await next();
  };
}

/**
 * A tighter limit for the subscribe endpoint, on its own binding.
 *
 * The upload limit (20/min) is a sensible ceiling for uploads and far too
 * generous for something that sends mail to an address the caller typed —
 * that ceiling would let one IP mail-bomb a victim 20 times a minute. Double
 * opt-in means the mail is only ever a confirm request, but the volume still
 * matters.
 */
export function subscribeRateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = clientIp((n) => c.req.header(n));
    const { success } = await c.env.SUBSCRIBE_LIMITER.limit({ key: ip });
    if (!success) {
      return c.json({ error: 'Too many attempts. Please wait a moment and try again.' }, 429);
    }
    await next();
  };
}
